import Link from 'next/link';
import LanguageSelector from '@/components/LanguageSelector';

const memberHighlights = [
  {
    quote: 'I met someone who speaks my language—art, travel, and slow Sundays.',
    author: 'Amara',
    location: 'NYC',
  },
  {
    quote: 'We planned our first gallery crawl within a week of matching.',
    author: 'Noah',
    location: 'Chicago',
  },
  {
    quote: 'Sorority reminded me that chemistry can be intentional and electric.',
    author: 'Lana',
    location: 'Austin',
  },
  {
    quote: 'Our Saturday coffee chats turned into a moonlit rooftop proposal.',
    author: 'Priya & Eli',
    location: 'Toronto',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">♥</span>
              </div>
              <Link href="/" className="text-2xl font-bold text-pink-600">
                Sorority<span className="text-red-500">❤️</span>
              </Link>
            </div>

            <LanguageSelector/>
            
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-700 hover:text-pink-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Spotlight */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-100 via-pink-50 to-white opacity-70" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-pink-500 font-semibold mb-4">Where Real Stories Begin</p>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight">
                Love deserves a place that feels <span className="text-pink-600">intentional</span>.
              </h1>
              <p className="mt-6 text-lg text-gray-600 max-w-xl">
                Sorority is a curated community for people who crave more than endless swipes. Discover deeply profiled matches, rich storytelling prompts, and immersive experiences designed to spark chemistry.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/explore"
                  className="bg-pink-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg shadow-pink-200 hover:bg-pink-700 transition-colors"
                >
                  Preview the Discover Feed
                </Link>
                <Link
                  href="/register"
                  className="border border-pink-200 text-pink-700 px-6 py-3 rounded-lg font-semibold hover:bg-white/70 transition-colors"
                >
                  Create Your Story
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 text-sm text-gray-600">
                <div>
                  <p className="font-semibold text-gray-900">Curated Profiles</p>
                  <p>Verified stories, thoughtful prompts, zero bots.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Moments that Matter</p>
                  <p>Audio icebreakers, shared playlists, IRL pop-ups.</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-3xl shadow-2xl border border-pink-100 p-6">
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-pink-500 font-semibold">Member Highlights</p>
                  <div className="mt-3 relative">
                    <div className="overflow-hidden">
                      <div className="flex gap-4 marquee-track">
                        {[...memberHighlights, ...memberHighlights].map((highlight, index) => (
                          <div
                            key={`${highlight.author}-${index}`}
                            className="min-w-[260px] md:min-w-[320px] p-5 rounded-2xl bg-pink-50"
                          >
                            <p className="text-lg font-semibold text-gray-900">“{highlight.quote}”</p>
                            <p className="mt-4 text-sm text-pink-600">— {highlight.author}, {highlight.location}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-white to-pink-50">
                    <p className="text-3xl font-extrabold text-pink-600">92%</p>
                    <p className="text-xs text-gray-500">Feel more seen</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-white to-pink-50">
                    <p className="text-3xl font-extrabold text-pink-600">18 hrs</p>
                    <p className="text-xs text-gray-500">Avg. first convo</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-white to-pink-50">
                    <p className="text-3xl font-extrabold text-pink-600">+3x</p>
                    <p className="text-xs text-gray-500">Meaningful matches</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-pink-200 p-4 text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">Coming Soon</p>
                  <p>Invite-only supper clubs, travel buddy drops, and creative collabs. Join now to secure early access.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose Our Dating App?
            </h2>
            <p className="text-lg text-gray-600">
              We make it easy to find meaningful connections
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-pink-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Smart Matching
              </h3>
              <p className="text-gray-600">
                Our algorithm finds compatible matches based on your preferences, interests, and location.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-pink-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Real-time Chat
              </h3>
              <p className="text-gray-600">
                Connect instantly with your matches through our secure and private messaging system.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-pink-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🛡️</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Safe & Secure
              </h3>
              <p className="text-gray-600">
                Your privacy and safety are our top priorities. We verify profiles and provide reporting tools.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-pink-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Find Love?
          </h2>
          <p className="text-xl text-pink-100 mb-8">
            Join thousands of people who have found their perfect match
          </p>
          <Link
            href="/register"
            className="bg-white text-pink-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
          >
            Start Your Journey
            <span className="ml-2">→</span>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center items-center mb-4">
              <div className="h-8 w-8 bg-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">♥</span>
              </div>
              <span className="ml-2 text-xl font-bold">Sorority<span className="text-red-500">❤️</span></span>
            </div>
            <p className="text-gray-400">
              © 2024 Sorority<span className="text-red-500">❤️</span>. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
