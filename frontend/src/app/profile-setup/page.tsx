'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { profilesAPI, authAPI } from '@/lib/api';
import { Heart, MapPin, Calendar, Users, Camera } from 'lucide-react';
import { showToast } from '@/utils/toastUtils';
import { Profile, Photo } from '@/types/profiles';
import Navbar from '@/components/Navbar'; // Import the Navbar component
import Image from 'next/image'; // Import Next.js Image component
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

interface ProfileSetupData {
  bio: string;
  date_of_birth: string;
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  looking_for: 'Long-term relationship' | 'Short-term relationship' | 'Friendship' | 'Casual dating';
  relationship_status: 'Single' | 'In a relationship' | 'Married';
  location: string;
  country: string;
  state_province: string;
  max_distance: number;
  min_age: number;
  max_age: number;
  preferred_language: string;
  prompts: { id?: number; question: string; answer: string }[];
  values: string[];
  favorite_music: string[];
  passport_latitude: number | null;
  passport_longitude: number | null;
  is_passport_enabled: boolean;
}

type ValueOption = { id: number; name: string };

// These constants are now loaded from database via API
// const PREDEFINED_VALUES = [...];
// const GENDER_OPTIONS = [...];
// const LOOKING_FOR_OPTIONS = [...];
// const RELATIONSHIP_OPTIONS = [...];
// const LANGUAGE_OPTIONS = [...];
// const PREDEFINED_PROMPTS = [...];

export default function ProfileSetupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [primaryPhotoFile, setPrimaryPhotoFile] = useState<File | null>(null);
  const [otherPhotoFiles, setOtherPhotoFiles] = useState<File[]>([]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [availableValues, setAvailableValues] = useState<ValueOption[]>([]);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [selectedValueIds, setSelectedValueIds] = useState<number[]>([]);
  const [genderOptions, setGenderOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [lookingForOptions, setLookingForOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [relationshipOptions, setRelationshipOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [languageOptions, setLanguageOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [promptOptions, setPromptOptions] = useState<Array<{ value: string; label: string }>>([]);
  const primaryPhoto = profile?.photos.find(p => p.is_primary);

  // Photo limits
  const currentPhotoCount = profile?.photos.length || 0;
  const selectedPhotoCount = (primaryPhotoFile ? 1 : 0) + otherPhotoFiles.length;
  const totalPhotoCount = currentPhotoCount + selectedPhotoCount;
  const maxFreePhotos = 2;
  const canUploadMore = profile?.is_premium || totalPhotoCount < maxFreePhotos;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<ProfileSetupData>({
    defaultValues: {
      bio: '',
      date_of_birth: '',
      gender: 'Prefer not to say',
      looking_for: 'Long-term relationship',
      relationship_status: 'Single',
      location: '',
      country: '',
      state_province: '',
      max_distance: 50,
      min_age: 18,
      max_age: 100,
      preferred_language: 'en-us',
      prompts: [],
      values: [],
      favorite_music: [],
      passport_latitude: null,
      passport_longitude: null,
      is_passport_enabled: false,
    },
  });

  const selectedCountry = watch('country');

  useEffect(() => {
    const loadCountries = async () => {
      setIsLoadingCountries(true);
      try {
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name');
        const data = await response.json();
        const names = Array.isArray(data)
          ? data
              .map((c: any) => c?.name?.common)
              .filter(Boolean)
              .sort((a: string, b: string) => a.localeCompare(b))
          : [];
        setCountries(names);
      } catch (err) {
        console.error('Error loading countries', err);
        setCountries(['United States', 'Canada', 'United Kingdom']);
      } finally {
        setIsLoadingCountries(false);
      }
    };

    const loadValues = async () => {
      setIsLoadingValues(true);
      try {
        const aggregated: ValueOption[] = [];
        let page = 1;
        let hasNext = true;
        const PAGE_SIZE = 100;
        const PAGE_LIMIT = 50; // Avoid endless loops if API misbehaves

        while (hasNext && page <= PAGE_LIMIT) {
          const response = await profilesAPI.getValues({ page, page_size: PAGE_SIZE });
          const payload = response.data as any;
          const pageValues: ValueOption[] = Array.isArray(payload)
            ? (payload as ValueOption[])
            : Array.isArray(payload?.results)
              ? (payload.results as ValueOption[])
              : [];

          aggregated.push(...pageValues);

          if (Array.isArray(payload?.results)) {
            hasNext = Boolean(payload?.next);
          } else {
            hasNext = false;
          }

          page += 1;
        }

        setAvailableValues(aggregated);
      } catch (err) {
        console.error('Error loading values', err);
        setAvailableValues([]);
      } finally {
        setIsLoadingValues(false);
      }
    };

    const loadOptions = async () => {
      try {
        // Load all option categories
        const [genderRes, lookingForRes, relationshipRes, languageRes, promptRes] = await Promise.all([
          profilesAPI.getOptions('gender'),
          profilesAPI.getOptions('looking_for'),
          profilesAPI.getOptions('relationship_status'),
          profilesAPI.getOptions('language'),
          profilesAPI.getOptions('prompt'),
        ]);

        const genderOptionsArr = Array.isArray(genderRes.data) ? genderRes.data : (genderRes.data.results || []);
        const lookingForOptionsArr = Array.isArray(lookingForRes.data) ? lookingForRes.data : (lookingForRes.data.results || []);
        const relationshipOptionsArr = Array.isArray(relationshipRes.data) ? relationshipRes.data : (relationshipRes.data.results || []);
        const languageOptionsArr = Array.isArray(languageRes.data) ? languageRes.data : (languageRes.data.results || []);
        const promptOptionsArr = Array.isArray(promptRes.data) ? promptRes.data : (promptRes.data.results || []);

        setGenderOptions(genderOptionsArr.map((opt: any) => ({ value: opt.value, label: opt.label })));
        setLookingForOptions(lookingForOptionsArr.map((opt: any) => ({ value: opt.value, label: opt.label })));
        setRelationshipOptions(relationshipOptionsArr.map((opt: any) => ({ value: opt.value, label: opt.label })));
        setLanguageOptions(languageOptionsArr.map((opt: any) => ({ value: opt.value, label: opt.label })));
        setPromptOptions(promptOptionsArr.map((opt: any) => ({ value: opt.value, label: opt.label })));

        console.log('Loaded options from database');
      } catch (err) {
        console.error('Error loading options', err);
        // Fallback to hardcoded values if API fails
        setGenderOptions([
          { value: 'Male', label: 'Male' },
          { value: 'Female', label: 'Female' },
          { value: 'Other', label: 'Other' },
          { value: 'Prefer not to say', label: 'Prefer not to say' },
        ]);
        setLookingForOptions([
          { value: 'Long-term relationship', label: 'Long-term relationship' },
          { value: 'Short-term relationship', label: 'Short-term relationship' },
          { value: 'Friendship', label: 'Friendship' },
          { value: 'Casual dating', label: 'Casual dating' },
        ]);
        setRelationshipOptions([
          { value: 'Single', label: 'Single' },
          { value: 'In a relationship', label: 'In a relationship' },
          { value: 'Married', label: 'Married' },
        ]);
        setLanguageOptions([
          { value: 'en-us', label: 'English' },
          { value: 'fr', label: 'French' },
          { value: 'es', label: 'Spanish' },
        ]);
        setPromptOptions([
          { value: 'My ideal first date is...', label: 'My ideal first date is...' },
          { value: 'A perfect day for me includes...', label: 'A perfect day for me includes...' },
          { value: 'My hidden talent is...', label: 'My hidden talent is...' },
          { value: 'I am an expert at...', label: 'I am an expert at...' },
          { value: 'My favorite way to relax is...', label: 'My favorite way to relax is...' },
          { value: "The most spontaneous thing I've done is...", label: "The most spontaneous thing I've done is..." },
        ]);
      }
    };

    loadCountries();
    loadValues();
    loadOptions();
  }, []);

  useEffect(() => {
    if (!selectedCountry) {
      setStates([]);
      setValue('state_province', '');
      return;
    }

    const loadStates = async () => {
      setIsLoadingStates(true);
      try {
        const response = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country: selectedCountry }),
        });
        const data = await response.json();
        const stateNames = data?.data?.states?.map((s: any) => s.name).filter(Boolean) || [];
        setStates(stateNames);
        if (!stateNames.length) {
          setValue('state_province', '');
        }
      } catch (err) {
        console.error('Error loading states', err);
        setStates([]);
      } finally {
        setIsLoadingStates(false);
      }
    };

    loadStates();
  }, [selectedCountry, setValue]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user && user.profile?.slug) {
        try {
          const response = await profilesAPI.getProfile(user.profile.slug);
          setProfile(response.data);
          reset({
            bio: response.data.bio || '',
            date_of_birth: response.data.date_of_birth || '',
            gender: response.data.gender || 'Prefer not to say',
            looking_for: response.data.looking_for || 'Long-term relationship',
            relationship_status: response.data.relationship_status || 'Single',
            location: response.data.location || '',
            country: response.data.country || '',
            state_province: response.data.state_province || '',
            max_distance: response.data.max_distance || 50,
            min_age: response.data.min_age || 18,
            max_age: response.data.max_age || 100,
            preferred_language: response.data.preferred_language || 'en-us',
            prompts: response.data.prompts || [],
            //values: response.data.values?.map((v: { id: number; value: string }) => v.value) || [],
            values: response.data.values?.filter((v: any) => v !== null).map((v: { id: number; value: string }) => v.value) || [],
            favorite_music: response.data.favorite_music || [],
            passport_latitude: response.data.passport_latitude || null,
            passport_longitude: response.data.passport_longitude || null,
            is_passport_enabled: response.data.is_passport_enabled || false,
          });
          // Initialize image files if profile has photos
          const primary = response.data.photos.find((p: Photo) => p.is_primary);
          if (primary) {
            // For existing photos, we don't re-set file objects, just display them.
            // The actual file upload logic will handle new selections.
          }
          
          // Load existing profile values
          try {
            const profileValuesResponse = await profilesAPI.getProfileValues();
            const profileValues = Array.isArray(profileValuesResponse.data) 
              ? profileValuesResponse.data 
              : (profileValuesResponse.data.results || []);
            const valueIds = profileValues.map((pv: any) => pv.value.id);
            setSelectedValueIds(valueIds);
            console.log('Loaded profile value IDs:', valueIds);
          } catch (error) {
            console.error('Error loading profile values:', error);
            setSelectedValueIds([]);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          setProfile(null);
        }
      }
    };
    fetchProfile();
  }, [user, reset]);

  // Sync form field 'values' with selectedValueIds for correct highlighting and submission
  useEffect(() => {
    setValue('values', selectedValueIds);
  }, [selectedValueIds, setValue]);

  const onSubmit = (data: ProfileSetupData) => {
    console.log('onSubmit called with data:', data);
    // Handle the async operations
    (async () => {
      setIsLoading(true);
      console.log('Starting profile update process...');
      try {
        // Handle photo uploads separately
        if (primaryPhotoFile) {
          try {
            console.log('Uploading primary photo...');
            const photoFormData = new FormData();
            photoFormData.append('image', primaryPhotoFile);
            photoFormData.append('is_primary', 'true');
            await profilesAPI.uploadPhoto(photoFormData);
            console.log('Primary photo uploaded successfully');
          } catch (photoError) {
            console.error('Error uploading primary photo:', photoError);
            // Continue with profile update even if photo upload fails
          }
        }

        // Upload other photos
        for (const file of otherPhotoFiles) {
          try {
            console.log('Uploading additional photo...');
            const photoFormData = new FormData();
            photoFormData.append('image', file);
            photoFormData.append('is_primary', 'false');
            await profilesAPI.uploadPhoto(photoFormData);
            console.log('Additional photo uploaded successfully');
          } catch (photoError) {
            console.error('Error uploading photo:', photoError);
            // Continue with profile update even if photo upload fails
          }
        }

        // Prepare profile data (exclude photo-related fields)
        const profileData = {
          bio: data.bio,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          looking_for: data.looking_for,
          relationship_status: data.relationship_status,
          location: data.location,
          country: data.country,
          state_province: data.state_province,
          max_distance: data.max_distance,
          min_age: data.min_age,
          max_age: data.max_age,
          preferred_language: data.preferred_language,
          prompts: data.prompts,
          values: data.values,
          favorite_music: data.favorite_music,
          passport_latitude: data.is_passport_enabled && !isNaN(data.passport_latitude) ? data.passport_latitude : null,
          passport_longitude: data.is_passport_enabled && !isNaN(data.passport_longitude) ? data.passport_longitude : null,
          is_passport_enabled: data.is_passport_enabled,
        };

        console.log('Sending profile data:', profileData);

        if (profile) {
          console.log('Updating existing profile...');
          await profilesAPI.updateProfile(profile.slug, profileData);
          showToast('Profile updated successfully!', 'success');
        } else {
          console.log('Creating new profile...');
          await profilesAPI.createProfile(profileData);
          showToast('Profile created successfully!', 'success');
        }

        console.log('Fetching updated user profile...');
        const updatedUserResponse = await authAPI.getProfile();
        if (user && updatedUserResponse.data.profile) {
          updateUser({ ...user, profile: updatedUserResponse.data.profile });
        }

        // Save selected values to database
        if (profile && selectedValueIds.length > 0) {
          try {
            // Get existing profile values
            const existingValuesResponse = await profilesAPI.getProfileValues();
            const existingValuesArr = Array.isArray(existingValuesResponse.data)
              ? existingValuesResponse.data
              : (existingValuesResponse.data.results || []);
            const existingValueIds = existingValuesArr.map((pv: any) => pv.value.id);
            // Delete values that were unselected
            for (const existing of existingValuesArr) {
              if (!selectedValueIds.includes(existing.value.id)) {
                await profilesAPI.removeProfileValue(existing.id);
              }
            }
            // Add newly selected values
            for (const valueId of selectedValueIds) {
              if (!existingValueIds.includes(valueId)) {
                await profilesAPI.addProfileValue({ value_id: valueId });
              }
            }
          } catch (valueError) {
            console.error('Error saving values:', valueError);
          }
        }

        console.log('Redirecting to dashboard...');
        router.push('/dashboard');
      } catch (error: any) {
        console.error('Error saving profile:', error);
        const errorMessage = error.response?.data?.error || error.message || 'Failed to save profile';
        showToast(errorMessage, 'error');
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'primary' | 'other') => {
    if (e.target.files && e.target.files.length > 0) {
      if (type === 'primary') {
        setPrimaryPhotoFile(e.target.files[0]);
      } else {
        setOtherPhotoFiles(Array.from(e.target.files));
      }
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by this browser.', 'error');
      console.error('Geolocation not supported');
      return;
    }

    console.log('Starting geolocation request with high accuracy...');
    setIsGettingLocation(true);
    
    // First attempt: High accuracy with longer timeout
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Geolocation success:', position);
        const { latitude, longitude } = position.coords;
        console.log('Coordinates:', latitude, longitude);
        
        setValue('passport_latitude', Number(latitude), { 
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true 
        });
        setValue('passport_longitude', Number(longitude), { 
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true 
        });
        
        console.log('Values set. Current form values:', watch('passport_latitude'), watch('passport_longitude'));
        setIsGettingLocation(false);
        showToast(`Location detected: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, 'success');
      },
      (error) => {
        console.error('High accuracy geolocation failed:', error);
        
        // If timeout, try again with low accuracy (faster)
        if (error.code === error.TIMEOUT) {
          console.log('Timeout with high accuracy, trying low accuracy mode...');
          showToast('Retrying with low accuracy mode...', 'info');
          
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('Low accuracy geolocation success:', position);
              const { latitude, longitude } = position.coords;
              console.log('Coordinates:', latitude, longitude);
              
              setValue('passport_latitude', Number(latitude), { 
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true 
              });
              setValue('passport_longitude', Number(longitude), { 
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true 
              });
              
              setIsGettingLocation(false);
              showToast(`Location detected (approximate): ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, 'success');
            },
            (error2) => {
              console.error('Low accuracy geolocation also failed:', error2);
              setIsGettingLocation(false);
              handleGeolocationError(error2);
            },
            {
              enableHighAccuracy: false, // Low accuracy for speed
              timeout: 10000,
              maximumAge: 60000, // Accept cached position up to 1 minute old
            }
          );
        } else {
          setIsGettingLocation(false);
          handleGeolocationError(error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // 30 seconds for high accuracy
        maximumAge: 0,
      }
    );
  };

  const handleGeolocationError = (error: GeolocationPositionError) => {
    let errorMessage = 'Unable to retrieve your location.';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
        console.error('Permission denied');
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information is unavailable. Please check your device settings.';
        console.error('Position unavailable');
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out. Try moving to a window or entering coordinates manually.';
        console.error('Timeout');
        break;
      default:
        console.error('Unknown error:', error.message);
    }
    showToast(errorMessage, 'error');
  };

  // Auto-detect location when passport is enabled
  const isPassportEnabled = watch('is_passport_enabled');
  const passportLatitude = watch('passport_latitude');
  const passportLongitude = watch('passport_longitude');

  useEffect(() => {
    if (isPassportEnabled && (passportLatitude === null || passportLatitude === undefined) && (passportLongitude === null || passportLongitude === undefined)) {
      getCurrentLocation();
    }
  }, [isPassportEnabled]);

  if (!user) {
    return <div>Loading user information...</div>;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-12 px-4">
        <Navbar />
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex justify-center">
              <Heart className="h-12 w-12 text-pink-500" />
            </div>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              {profile ? 'Edit Your Profile' : 'Complete Your Profile'}
            </h1>
            <p className="mt-2 text-lg text-gray-700 font-medium">
              Tell us about yourself and what you are looking for.
            </p>
            <p className="mt-2 text-gray-600">
              Fill out the details below to create a compelling profile that attracts meaningful connections.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit, (errors) => {
            console.error('Form validation errors:', errors);
            // Show first validation error
            const firstError = Object.values(errors)[0];
            if (firstError && typeof firstError === 'object' && 'message' in firstError) {
              showToast(firstError.message as string, 'error');
            }
          })} className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <p className="text-sm text-gray-600 mb-6">Tell us a bit about yourself to get started.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bio
                  </label>
                  <p className="text-xs text-gray-500 mb-1">Share a few words about your personality, hobbies, and what you're looking for.</p>
                  <textarea
                    {...register('bio', {
                      required: 'Bio is required',
                      maxLength: {
                        value: 500,
                        message: 'Bio must be less than 500 characters',
                      },
                    })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                    placeholder="Tell us about yourself..."
                  />
                  {errors.bio && (
                    <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      {...register('date_of_birth', {
                        required: 'Date of birth is required',
                        validate: (value) => {
                          if (!value) return 'Date of birth is required';
                          try {
                            const birthDate = new Date(value);
                            if (isNaN(birthDate.getTime())) return 'Invalid date format';
                            const today = new Date();
                            let age = today.getFullYear() - birthDate.getFullYear();
                            const m = today.getMonth() - birthDate.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                              age--;
                            }
                            return age >= 18 || 'You must be at least 18 years old';
                          } catch (error) {
                            return 'Invalid date';
                          }
                        },
                      })}
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                    />
                    {errors.date_of_birth && (
                      <p className="mt-1 text-sm text-red-600">{errors.date_of_birth.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      {...register('gender', { required: 'Gender is required' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                    >
                      <option value="">Select gender</option>
                      {genderOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors.gender && (
                      <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Looking for
                    </label>
                    <select
                      {...register('looking_for', { required: 'Looking for is required' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                    >
                      <option value="">Select option</option>
                      {lookingForOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors.looking_for && (
                      <p className="mt-1 text-sm text-red-600">{errors.looking_for.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Relationship Status
                    </label>
                    <select
                      {...register('relationship_status', { required: 'Relationship status is required' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                    >
                      <option value="">Select status</option>
                      {relationshipOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors.relationship_status && (
                      <p className="mt-1 text-sm text-red-600">{errors.relationship_status.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">About You</h2>
              <p className="text-sm text-gray-600 mb-6">Share more about your personality and preferences to help others get to know you.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prompts</label>
                  <p className="text-xs text-gray-500 mb-1">Add up to 3 prompts to express yourself. Choose a question and provide a thoughtful answer.</p>
                  <Controller
                    name="prompts"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-3">
                        {field.value.map((prompt, index) => (
                          <div key={index} className="flex flex-col space-y-2 border border-gray-200 rounded-md p-3">
                            <select
                              value={prompt.question}
                              onChange={(e) => {
                                const newPrompts = [...field.value];
                                newPrompts[index] = { ...newPrompts[index], question: e.target.value };
                                field.onChange(newPrompts);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                            >
                              <option value="">Select a prompt question</option>
                              {promptOptions.map((q) => (
                                <option key={q.value} value={q.value}>{q.label}</option>
                              ))}
                            </select>
                            <textarea
                              value={prompt.answer}
                              onChange={(e) => {
                                const newPrompts = [...field.value];
                                newPrompts[index] = { ...newPrompts[index], answer: e.target.value };
                                field.onChange(newPrompts);
                              }}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                              placeholder="Your answer..."
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newPrompts = field.value.filter((_, i) => i !== index);
                                field.onChange(newPrompts);
                              }}
                              className="text-red-600 hover:text-red-800 text-sm self-end"
                            >
                              Remove Prompt
                            </button>
                          </div>
                        ))}
                        {field.value.length < 3 && (
                          <button
                            type="button"
                            onClick={() => field.onChange([...field.value, { question: '', answer: '' }])}
                            className="w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-pink-600 bg-pink-100 hover:bg-pink-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                          >
                            Add Prompt
                          </button>
                        )}
                      </div>
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">My Values</label>
                  <p className="text-xs text-gray-500 mb-1">Select values that are important to you (up to 10).</p>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
                    {isLoadingValues ? (
                      <p className="text-sm text-gray-500">Loading values...</p>
                    ) : Array.isArray(availableValues) && availableValues.length > 0 ? (
                      availableValues.map((value) => (
                        <button
                          type="button"
                          key={value.id}
                          onClick={() => {
                            setSelectedValueIds((prev) => {
                              if (prev.includes(value.id)) {
                                return prev.filter(id => id !== value.id);
                              } else if (prev.length < 10) {
                                return [...prev, value.id];
                              }
                              return prev;
                            });
                          }}
                          className={`px-4 py-2 rounded-full border text-sm font-medium ${selectedValueIds.includes(value.id) ? 'bg-pink-600 text-white border-pink-600' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'}`}
                        >
                          {value.name}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No values available.</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Favorite Music Genres</label>
                  <p className="text-xs text-gray-500 mb-1">List your favorite music genres, separated by commas (e.g., Pop, Rock, Jazz).</p>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                    placeholder="e.g., Pop, R&B, Electronic"
                    onChange={(e) => {
                      // Manually handle change to store as array of strings
                      const genres = e.target.value.split(',').map(g => g.trim()).filter(g => g);
                      setValue('favorite_music', genres);
                    }}
                    value={Array.isArray(watch('favorite_music')) ? watch('favorite_music').join(', ') : ''}
                  />
                  {errors.favorite_music && (
                    <p className="mt-1 text-sm text-red-600">{errors.favorite_music.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Location & Preferences</h2>
              <p className="text-sm text-gray-600 mb-6">Manage your location, distance preferences, and language settings.</p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <select
                      {...register('country', { required: 'Country is required' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {isLoadingCountries ? 'Loading countries...' : 'Select country'}
                      </option>
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                    {errors.country && (
                      <p className="mt-1 text-sm text-red-600">{errors.country.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State / Province</label>
                    {states.length > 0 ? (
                      <select
                        {...register('state_province', { required: 'State or province is required' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          {isLoadingStates ? 'Loading regions...' : 'Select state / province'}
                        </option>
                        {states.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        {...register('state_province', { required: 'State or province is required' })}
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                        placeholder={selectedCountry ? 'Enter state or province' : 'Select country first'}
                        disabled={!selectedCountry}
                      />
                    )}
                    {errors.state_province && (
                      <p className="mt-1 text-sm text-red-600">{errors.state_province.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City / Local Area
                  </label>
                  <input
                    {...register('location', {
                      required: 'City or local area is required',
                    })}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                    placeholder="City or neighborhood"
                  />
                  {errors.location && (
                    <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Age
                    </label>
                    <input
                      {...register('min_age', {
                        required: 'Minimum age is required',
                        min: { value: 18, message: 'Minimum age must be at least 18' },
                        max: { value: watch('max_age') || 100, message: 'Minimum age cannot be greater than maximum age' },
                        valueAsNumber: true,
                      })}
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                    />
                    {errors.min_age && (
                      <p className="mt-1 text-sm text-red-600">{errors.min_age.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Age
                    </label>
                    <input
                      {...register('max_age', {
                        required: 'Maximum age is required',
                        min: { value: watch('min_age') || 18, message: 'Maximum age cannot be less than minimum age' },
                        max: { value: 100, message: 'Maximum age cannot exceed 100' },
                        valueAsNumber: true,
                      })}
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                    />
                    {errors.max_age && (
                      <p className="mt-1 text-sm text-red-600">{errors.max_age.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Distance (km)
                  </label>
                  <p className="text-xs text-gray-500 mb-1">How far are you willing to travel for a date?</p>
                  <input
                    {...register('max_distance', {
                      required: 'Max distance is required',
                      min: { value: 1, message: 'Must be at least 1 km' },
                      max: { value: 500, message: 'Must be less than 500 km' },
                      valueAsNumber: true,
                    })}
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                  />
                  {errors.max_distance && (
                    <p className="mt-1 text-sm text-red-600">{errors.max_distance.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Language
                  </label>
                  <p className="text-xs text-gray-500 mb-1">Choose your preferred language for app content and translations.</p>
                  <select
                    {...register('preferred_language', { required: 'Preferred language is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                  >
                    <option value="">Select a language</option>
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.preferred_language && (
                    <p className="mt-1 text-sm text-red-600">{errors.preferred_language.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Passport Settings (Optional)</h2>
              <p className="text-sm text-gray-600 mb-6">Enable virtual location to connect with people anywhere in the world. Your location will be detected automatically.</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="is_passport_enabled" className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="is_passport_enabled"
                      {...register('is_passport_enabled')}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 dark:peer-focus:ring-pink-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-pink-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-900">Enable Passport (Virtual Location)</span>
                  </label>
                </div>

                {watch('is_passport_enabled') && (
                  <>
                    {isGettingLocation && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                          <p className="text-sm text-blue-800">Detecting your location... This may take up to 30 seconds.</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Virtual Latitude
                        </label>
                        <input
                          {...register('passport_latitude', {
                            valueAsNumber: true,
                            validate: (value) => {
                              if (watch('is_passport_enabled') && (value === null || value === undefined || isNaN(value))) {
                                return 'Latitude is required for Passport';
                              }
                              return true;
                            },
                          })}
                          type="number"
                          step="any"
                          disabled={isGettingLocation}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="Auto-detecting..."
                        />
                        {errors.passport_latitude && (
                          <p className="mt-1 text-sm text-red-600">{errors.passport_latitude.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Virtual Longitude
                        </label>
                        <input
                          {...register('passport_longitude', {
                            valueAsNumber: true,
                            validate: (value) => {
                              if (watch('is_passport_enabled') && (value === null || value === undefined || isNaN(value))) {
                                return 'Longitude is required for Passport';
                              }
                              return true;
                            },
                          })}
                          type="number"
                          step="any"
                          disabled={isGettingLocation}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="Auto-detecting..."
                        />
                        {errors.passport_longitude && (
                          <p className="mt-1 text-sm text-red-600">{errors.passport_longitude.message}</p>
                        )}
                      </div>
                    </div>

                    {passportLatitude !== null && passportLatitude !== undefined && !isNaN(passportLatitude) && 
                     passportLongitude !== null && passportLongitude !== undefined && !isNaN(passportLongitude) && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm text-green-800 font-semibold">
                          ✓ Location detected successfully: {Number(passportLatitude).toFixed(4)}, {Number(passportLongitude).toFixed(4)}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      disabled={isGettingLocation}
                      className="mt-2 w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MapPin className="mr-2" size={16} />
                      {isGettingLocation ? 'Detecting...' : 'Retry Location Detection'}
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Location is auto-detected when you enable Passport. Click "Retry" if detection fails.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Photo Upload Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Photos</h2>
              <p className="text-sm text-gray-600 mb-6">
                Upload your best photos to attract more matches! You can set one as primary.
                {!profile?.is_premium && (
                  <span className="block mt-2 text-orange-600">
                    Free users can upload up to {maxFreePhotos} photos.{' '}
                    <Link href="/billing" className="text-pink-600 hover:text-pink-700 font-semibold underline">
                      Upgrade to premium
                    </Link>{' '}
                    for unlimited photos.
                  </span>
                )}
              </p>

              <div className="space-y-4">
                {/* Primary Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'primary')}
                    disabled={!canUploadMore && !primaryPhotoFile && !primaryPhoto}
                    className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 ${!canUploadMore && !primaryPhotoFile && !primaryPhoto ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {(!canUploadMore && !primaryPhotoFile && !primaryPhoto) && (
                    <p className="mt-1 text-sm text-orange-600">
                      Upgrade to premium to upload more photos.{' '}
                      <Link href="/billing" className="text-pink-600 hover:text-pink-700 font-semibold underline">
                        Upgrade now
                      </Link>
                    </p>
                  )}
                  {primaryPhoto && (
                    <div className="mt-4 relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200">
                      <Image
                        src={primaryPhoto.image || '/images/placeholder-avatar.png'}
                        alt="Primary Photo" 
                        fill 
                        unoptimized
                      />
                    </div>
                  )}
                </div>

                {/* Other Photos Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Other Photos ({totalPhotoCount}/{profile?.is_premium ? 'Unlimited' : maxFreePhotos})
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileChange(e, 'other')}
                    disabled={!canUploadMore}
                    className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 ${!canUploadMore ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {!canUploadMore && (
                    <p className="mt-1 text-sm text-orange-600">
                      You've reached the photo limit.{' '}
                      <Link href="/billing" className="text-pink-600 hover:text-pink-700 font-semibold underline">
                        Upgrade to premium
                      </Link>{' '}
                      for unlimited photos.
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {profile?.photos.filter(p => !p.is_primary).map((photo) => (
                      <div key={photo.id} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                        <Image
                          src={photo.image}
                          alt="Other Photo"
                          fill 
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving Profile...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
