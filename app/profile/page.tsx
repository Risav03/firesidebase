'use client'

import { useGlobalContext } from '@/utils/providers/globalContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import NavigationWrapper from '@/components/NavigationWrapper';
import { IoIosArrowBack } from 'react-icons/io';
import { IoRefreshOutline } from 'react-icons/io5';
import { FaXTwitter } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import sdk from '@farcaster/miniapp-sdk';
import { fetchUserRooms, refreshUserProfile } from '@/utils/serverActions';
import { Card } from '@/components/UI/Card';
import Navigation from '@/components/Navigation';
import MainHeader from '@/components/UI/MainHeader';
import { useNavigateWithLoader } from '@/utils/useNavigateWithLoader';

export default function ProfilePage() {
  const { user, setUser } = useGlobalContext();
  const router = useRouter();
  const navigate = useNavigateWithLoader();
  const [hostedRooms, setHostedRooms] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [totalAudience, setTotalAudience] = useState<number>(0);
  const [maxAudience, setMaxAudience] = useState<any>(null);

  // Platform icons mapping
  const platformIcons: { [key: string]: React.ReactNode } = {
    'x': <FaXTwitter className="w-4 h-4" />,
    'twitter': <FaXTwitter className="w-4 h-4" />,
  };

  // Platform URL mapping
  const platformUrls: { [key: string]: string } = {
    'x': 'https://x.com/',
    'twitter': 'https://twitter.com/',
  };

  const handleSocialClick = (platform: string, username: string) => {
    const baseUrl = platformUrls[platform.toLowerCase()];
    if (baseUrl) {
      window.open(`${baseUrl}${username}`, '_blank');
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/');
    } else if (user.hostedRooms && user?.hostedRooms?.length > 0) {
      // Fetch hosted rooms details from API
      fetchUserRooms(user.username)
        .then(response => {
          if (response.ok) {
            // console.log('Fetched hosted rooms:', response.data.data);
            setHostedRooms(response.data.data.rooms || []);
            setTotalAudience(response.data.data.totalAudienceEngaged || 0);
            setMaxAudience(response.data.data.maxAudienceEngaged || 0);
          }
        });

      
        
    } else {
      setHostedRooms([]);
    }
  }, [user, router]);


  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-white mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <MainHeader/>
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
          
          <Card className="bg-transparent pt-16 border-0">
            {/* Profile Picture and Refresh Button */}
            <Card className="text-center p-4 relative flex items-center gap-4 justify-start">
              <div className="flex items-center justify-center">
                {user.pfp_url ? (
                  <img 
                    src={user.pfp_url} 
                    alt="Profile" 
                    className="w-24 h-24 rounded-full object-cover border-2 border-fireside-orange"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className='flex flex-col gap-2 items-start'>
                <p className="fire text-lg font-bold gradient-fire-text">
                  {user.username.slice(0,20) || 'Not set'}
                </p>
                {user.socials && Object.keys(user.socials).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(user.socials).map(([platform, username]) => (
                      <button
                        key={platform}
                        onClick={() => handleSocialClick(platform, String(username))}
                        className="flex items-center space-x-2 px-3 py-2 bg-white text-fireside-orange rounded-lg transition-all duration-200 group cursor-pointer"
                      >
                        <div className="flex items-center justify-center">
                          {platformIcons[platform.toLowerCase()] || (
                            <span className="text-xs font-medium text-gray-300 uppercase">
                              {platform.charAt(0)}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium group-hover:text-orange-300 transition-colors">
                          @{String(username)}
                        </span>
                      </button>
                    ))}
                  </div>
              )}
              </div>
              
              
              
            </Card>

            {/* Statistics Section */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-white mb-4">Statistics</h2>
              <div className="grid grid-cols-2 gap-3">
                {/* Total Hosted Rooms Card */}
                <Card className="bg-white rounded-xl p-4 shadow-md border-fireside-orange/50 hover:shadow-xl transition-shadow">
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-fireside-orange/80 text-xs font-medium mb-1 text-center">
                      Hosted Rooms
                    </p>
                    <p className="gradient-fire-text text-3xl font-bold">{hostedRooms?.length || 0}</p>
                  </div>
                </Card>

                {/* Total Audience Engaged Card */}
                <Card className="bg-fireside-orange rounded-xl border-white/50 p-4 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-white/80 text-xs font-medium mb-1 text-center">
                      Audience Engaged
                    </p>
                    <p className="text-white text-3xl font-bold">{totalAudience}</p>
                  </div>
                </Card>

                {/* Max Audience Engaged Card - Full Width */}
                <Card className="col-span-2 rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white/80 text-sm font-medium">
                        Max Audience Engaged
                      </p>
                      <p className="text-white text-2xl font-bold">{maxAudience?.participantCount || 0}</p>
                    </div>
                    {maxAudience && (
                      <Card onClick={()=>{navigate(`/recordings/${maxAudience.roomId}`)}} className='bg-fireside-orange border-white/50 backdrop-blur-sm rounded-lg p-2'>
                        <h2 className='gradient-fire-text text-lg font-bold mb-1 text-white'>{maxAudience?.name}</h2>
                        <p className='text-xs text-white/70 font-semibold'>Hosted on {new Date(maxAudience?.startTime).toDateString()}</p>
                      </Card>
                    )}
                  </div>
                </Card>

                {/* <div className="col-span-2 bg-fireside-orange rounded-xl p-5 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-sm font-medium mb-0">
                        Total Earnings
                      </p>
                      <p className="text-white/60 text-xs mb-2">
                        Earnings from tips + ads
                      </p>
                    </div>
                    <p className="text-white text-2xl font-bold">$0</p>
                  </div>
                </div> */}
              </div>
            </div>

            {/* Previous Spaces Section */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-white mb-4">Hosted Firesides</h2>
              <div className="flex space-x-2 overflow-x-auto ">
                {hostedRooms.length === 0 ? (
                  <Card className="w-full h-32 px-10 text-nowrap flex items-center justify-center text-gray-400">
                    No hosted firesides yet.
                  </Card>
                ) : (
                  hostedRooms.map((room, idx) => (
                    <Card
                      key={room._id || idx}
                      onClick={() => navigate(`/recordings/${room.roomId}`)}
                      className="w-[250px] relative flex-shrink-0 p-2 h-32 bg-fireside-orange/10 border-fireside-orange/20 flex flex-col justify-start text-white rounded-lg cursor-pointer hover:bg-fireside-orange/20 transition-colors"
                    >
                      <div className="font-bold text-lg mb-1">{room.name}</div>
                      <div className="text-xs text-gray-300 mb-1 truncate">{room.description.slice(0, 150)}</div>
                      <div className="text-xs text-fireside-orange mb-1">Tags: {room.topics?.join(', ')}</div>
                      <div className="absolute bottom-2 left-2 text-[0.6rem] text-fireside-orange px-2 py-1 font-bold rounded-full bg-white text mb-1">{room.participantCount} attended</div>
                      <div className="absolute bottom-2 right-2 text-[0.6rem] bg-fireside-orange px-2 py-1 font-bold rounded-full text-white mb-1">{new Date(room.startTime).toDateString()}</div>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 ">
              <div className="w-full">
                {/* <button
                  onClick={() => router.push('/')}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-md transition-colors"
                >
                  <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Explore Rooms
                </button> */}
                
                <button
                  onClick={() => window.history.back()}
                  className="gradient-fire text-white w-full font-medium py-3 px-4 rounded-md transition-colors"
                >
                  <IoIosArrowBack className="inline mr-2" />
                  Go Back
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <NavigationWrapper />
    </>
  );
}
