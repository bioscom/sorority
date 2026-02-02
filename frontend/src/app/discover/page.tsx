'use client';

import Navbar from '@/components/Navbar';
import DiscoverFeed from '@/components/DiscoverFeed';

const DiscoverPage = () => {
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <Navbar />
      <div className="flex-1 overflow-y-auto p-4">
        <DiscoverFeed />
      </div>
    </div>
  );
};

export default DiscoverPage;
