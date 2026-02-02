import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ProfileBrowser from '@/components/ProfileBrowser';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      {/* Navigation 
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
      </nav>*/}

      {/* Profile Browser */}
      <Navbar />
      <ProfileBrowser />

      {/* Features Section 
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
      </div>*/}

      {/* CTA Section 
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
      </div>*/}

      {/* Footer 
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
      </footer>*/}
    </div>
  );
}
