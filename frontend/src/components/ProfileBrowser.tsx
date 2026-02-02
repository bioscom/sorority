'use client';

import { useState, useEffect, useRef } from 'react';
// Helper for country/state dropdowns
const fetchCountries = async () => {
  const response = await fetch('https://restcountries.com/v3.1/all?fields=name');
  const data = await response.json();
  return Array.isArray(data)
    ? data.map((c: any) => c?.name?.common).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b))
    : [];
};

const fetchStates = async (country: string) => {
  if (!country) return [];
  const response = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  });
  const data = await response.json();
  return data?.data?.states?.map((s: any) => s.name).filter(Boolean) || [];
};
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, MapPin, Filter, Grid, List, Layout, LogIn } from 'lucide-react';
import { profilesAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const isDev = process.env.NODE_ENV !== 'production';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/?api\/?$/, '') || '';
const DEFAULT_DEV_MEDIA_BASE = isDev ? 'http://localhost:8000' : '';
const MEDIA_BASE_URL = process.env.NEXT_PUBLIC_MEDIA_URL || API_BASE_URL || DEFAULT_DEV_MEDIA_BASE;

const resolvePhotoUrl = (path?: string | null): string | null => {
  if (!path) {
    return null;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (!MEDIA_BASE_URL) {
    return path.startsWith('/') ? path : `/${path}`;
  }
  return `${MEDIA_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const pickProfilePhoto = (profile: Profile): string | null => {
  const primary = resolvePhotoUrl(profile.primary_photo?.image);
  if (primary) {
    return primary;
  }
  const fallback = profile.photos?.find((photo) => Boolean(photo.image))?.image;
  return resolvePhotoUrl(fallback);
};

interface Profile {
  id: number;
  slug: string;
  full_name: string;
  current_age: number;
  bio: string;
  location: string;
  gender: string;
  primary_photo: {
    image: string;
  } | null;
  photos?: Array<{ id: number; image: string }>;
  interests: Array<{
    interest: {
      name: string;
    };
  }>;
}

type ViewMode = 'grid' | 'list' | 'card';

type LocationFilter = {
  latitude: number | null;
  longitude: number | null;
  max_distance: number | null;
};

export default function ProfileBrowser() {
  const { user } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState({
    min_age: '',
    max_age: '',
    gender: '',
    location: '',
    country: '',
    state_province: '',
    interests: '',
  });
  const [countries, setCountries] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({ latitude: null, longitude: null, max_distance: null });
  const guestGeoRequested = useRef(false);

  // Load countries on mount
  useEffect(() => {
    setIsLoadingCountries(true);
    fetchCountries().then(setCountries).finally(() => setIsLoadingCountries(false));
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (!filters.country) {
      setStates([]);
      setFilters(f => ({ ...f, state_province: '' }));
      return;
    }
    setIsLoadingStates(true);
    fetchStates(filters.country).then(setStates).finally(() => setIsLoadingStates(false));
  }, [filters.country]);

  useEffect(() => {
    if (!user?.profile) {
      guestGeoRequested.current = false;
      setLocationFilter(prev => {
        if (prev.latitude === null && prev.longitude === null && prev.max_distance === null) {
          return prev;
        }
        return { latitude: null, longitude: null, max_distance: null };
      });
      return;
    }

    const {
      is_passport_enabled,
      passport_latitude,
      passport_longitude,
      latitude,
      longitude,
      max_distance,
    } = user.profile;

    const resolvedLatitude = is_passport_enabled && passport_latitude != null ? passport_latitude : latitude;
    const resolvedLongitude = is_passport_enabled && passport_longitude != null ? passport_longitude : longitude;
    const resolvedDistance = max_distance ?? 100;

    setLocationFilter(prev => {
      if (
        prev.latitude === (resolvedLatitude ?? null) &&
        prev.longitude === (resolvedLongitude ?? null) &&
        prev.max_distance === (resolvedDistance ?? null)
      ) {
        return prev;
      }
      return {
        latitude: resolvedLatitude ?? null,
        longitude: resolvedLongitude ?? null,
        max_distance: resolvedDistance ?? null,
      };
    });
  }, [user]);

  useEffect(() => {
    if (user || guestGeoRequested.current) {
      return;
    }

    if (locationFilter.latitude !== null && locationFilter.longitude !== null) {
      return;
    }

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    guestGeoRequested.current = true;
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocationFilter({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          max_distance: 100,
        });
      },
      error => {
        console.warn('Unable to retrieve device location for profile browser', error);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, [user, locationFilter.latitude, locationFilter.longitude]);
  const [showFilters, setShowFilters] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  const fetchProfiles = async () => {
    setLoading(true);
    setError(null);

    try {
      // Only include filters that have values
      const activeFilters: Record<string, string> = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          activeFilters[key] = value;
        }
      });

      // Load profiles with pagination
      const params: Record<string, string | number> = {
        ordering: 'date_of_birth', // Sort by date of birth (youngest to oldest)
        page: currentPage,
        page_size: itemsPerPage,
        ...activeFilters // Include only non-empty filters
      };

      if (locationFilter.latitude != null && locationFilter.longitude != null) {
        params.latitude = locationFilter.latitude;
        params.longitude = locationFilter.longitude;
        if (locationFilter.max_distance != null) {
          params.max_distance = locationFilter.max_distance;
        }
      } else if (locationFilter.max_distance != null) {
        params.max_distance = locationFilter.max_distance;
      }
      const response = await profilesAPI.getPublicProfiles(params);
      setProfiles(response.data.results); // Extract the results array from paginated response
      setTotalItems(response.data.count); // Store total count for pagination
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [filters, currentPage, itemsPerPage, locationFilter.latitude, locationFilter.longitude, locationFilter.max_distance]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      min_age: '',
      max_age: '',
      gender: '',
      location: '',
      country: '',
      state_province: '',
      interests: '',
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleProfileClick = (profileSlug: string) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    router.push(`/profiles/${profileSlug}`);
  };

  const renderProfileCard = (profile: Profile) => {
    const photoUrl = pickProfilePhoto(profile);
    return (
      <div key={profile.id} onClick={() => handleProfileClick(profile.slug)} className="block">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">
          <div className="relative h-64">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={`${profile.full_name}'s profile`}
                fill
                unoptimized={isDev}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
                No Photo
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {profile.full_name}, {profile.current_age}
            </h3>
            <p className="text-gray-600 flex items-center mt-1">
              <MapPin className="h-4 w-4 mr-1" />
              {profile.location}
            </p>
            <p className="text-gray-700 mt-2 text-sm line-clamp-2">{profile.bio}</p>
            {profile.interests.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {profile.interests.slice(0, 3).map((interest, index) => (
                  <span key={index} className="bg-pink-100 text-pink-700 px-2 py-1 rounded-full text-xs">
                    {interest.interest.name}
                  </span>
                ))}
                {profile.interests.length > 3 && (
                  <span className="text-gray-500 text-xs">+{profile.interests.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  const renderProfileList = (profile: Profile) => {
    const photoUrl = pickProfilePhoto(profile);
    return (
      <div key={profile.id} onClick={() => handleProfileClick(profile.slug)} className="block">
        <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center space-x-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt={`${profile.full_name}'s profile`}
                  fill
                  unoptimized={isDev}
                  className="object-cover rounded-full"
                  sizes="64px"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-sm">
                  No Photo
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {profile.full_name}, {profile.current_age}
              </h3>
              <p className="text-gray-600 flex items-center text-sm">
                <MapPin className="h-3 w-3 mr-1" />
                {profile.location}
              </p>
              <p className="text-gray-700 mt-1 text-sm line-clamp-1">{profile.bio}</p>
              {profile.interests.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {profile.interests.slice(0, 2).map((interest, index) => (
                    <span key={index} className="bg-pink-100 text-pink-700 px-2 py-1 rounded-full text-xs">
                      {interest.interest.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  const renderProfileGrid = (profile: Profile) => {
    const photoUrl = pickProfilePhoto(profile);
    return (
      <div key={profile.id} onClick={() => handleProfileClick(profile.slug)} className="block">
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
          <div className="relative h-48">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={`${profile.full_name}'s profile`}
                fill
                unoptimized={isDev}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
                No Photo
              </div>
            )}
          </div>
          <div className="p-3">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {profile.full_name}, {profile.current_age}
            </h3>
            <p className="text-gray-600 flex items-center text-xs mt-1">
              <MapPin className="h-3 w-3 mr-1" />
              {profile.location}
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-lg text-gray-600">Loading profiles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Discover Amazing People
        </h2>
        <p className="text-lg text-gray-600">
          Browse profiles and find your perfect match
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-pink-100 text-pink-600' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Grid size={20} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-pink-100 text-pink-600' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <List size={20} />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded-md ${viewMode === 'card' ? 'bg-pink-100 text-pink-600' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Layout size={20} />
          </button>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          <Filter size={16} />
          <span>Filters</span>
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Age</label>
              <input
                type="number"
                value={filters.min_age}
                onChange={(e) => handleFilterChange('min_age', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="18"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Age</label>
              <input
                type="number"
                value={filters.max_age}
                onChange={(e) => handleFilterChange('max_age', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={filters.gender}
                onChange={(e) => handleFilterChange('gender', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">Any</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={filters.country}
                onChange={e => handleFilterChange('country', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">{isLoadingCountries ? 'Loading...' : 'Select country'}</option>
                {countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State / Province</label>
              {states.length > 0 ? (
                <select
                  value={filters.state_province}
                  onChange={e => handleFilterChange('state_province', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  disabled={!filters.country}
                >
                  <option value="">{isLoadingStates ? 'Loading...' : 'Select state/province'}</option>
                  {states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={filters.state_province}
                  onChange={e => handleFilterChange('state_province', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder={filters.country ? 'Enter state/province' : 'Select country first'}
                  disabled={!filters.country}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="City or Local Area"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interests</label>
              <input
                type="text"
                value={filters.interests}
                onChange={(e) => handleFilterChange('interests', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="hiking, reading, music"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 mr-2"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Profiles */}
      {profiles.length > 0 ? (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
            : viewMode === 'list'
            ? 'space-y-4'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
        }>
          {profiles.map((profile) => {
            if (viewMode === 'grid') {
              return renderProfileGrid(profile);
            } else if (viewMode === 'list') {
              return renderProfileList(profile);
            } else {
              return renderProfileCard(profile);
            }
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <Heart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-xl text-gray-600">No profiles found matching your criteria.</p>
          <p className="text-gray-500 mt-2">Try adjusting your filters or check back later.</p>
        </div>
      )}

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="px-3 py-2 border border-pink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 bg-pink-50 text-pink-700 font-semibold"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">per page</span>
            </div>

            {/* Pagination info */}
            <div className="text-sm text-gray-600">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to{' '}
              {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} profiles
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Previous
              </button>

              {/* Page numbers */}
              <div className="flex gap-1">
                {Array.from(
                  { length: Math.ceil(totalItems / itemsPerPage) },
                  (_, i) => i + 1
                )
                  .filter((page) => {
                    const totalPages = Math.ceil(totalItems / itemsPerPage);
                    // Show first page, last page, current page, and pages around current
                    return (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    );
                  })
                  .map((page, index, array) => (
                    <div key={page} className="flex items-center">
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="px-2 text-gray-400">...</span>
                      )}
                      <button
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-2 rounded-lg font-semibold transition-all duration-200 ${
                          page === currentPage
                            ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg transform scale-105'
                            : 'bg-pink-100 text-pink-700 hover:bg-pink-200 hover:shadow-md'
                        }`}
                      >
                        {page}
                      </button>
                    </div>
                  ))}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === Math.ceil(totalItems / itemsPerPage)}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center mt-12">
        <div className="bg-pink-600 text-white p-8 rounded-lg">
          <h3 className="text-2xl font-bold mb-4">Ready to Connect?</h3>
          <p className="text-pink-100 mb-6">
            Join our community and start matching with amazing people like these.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-white text-pink-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Create Your Profile
            </Link>
            <Link
              href="/login"
              className="border border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-pink-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                <LogIn className="h-12 w-12 text-pink-600 mx-auto mb-2" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Login Required</h3>
                <p className="text-gray-600">
                  You need to be logged in to view detailed profiles and connect with other users.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    router.push('/login');
                  }}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-700 transition-colors"
                >
                  Login Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}