import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import axios from 'axios';
import Button from '../../shared/button';
import FTable, { TabOption } from './fTable';
import Farmbanner from './farmbanner';
import AddFarmModal from '../../../Modals/website/addFarmModal';
import { useWallet } from '@txnlab/use-wallet';
import { TokenService } from '../../../services/TokenService';

// Helper function to validate image URL (outside component to avoid recreation)
const isValidImageUrl = (url: string | undefined | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  // Check if it's a valid URL format
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    // If URL parsing fails, check if it's a relative path or data URL
    return url.startsWith('data:') || url.startsWith('/') || url.includes('.png') || url.includes('.jpg') || url.includes('.svg');
  }
};

const FarmTable: React.FC = () => {
  // Initialize TokenService
  const tokenService = new TokenService();
  
  const { activeAddress: walletAddress } = useWallet();
  const [farms, setFarms] = useState<any[]>([]);
  const [isAddFarmOpen, setIsAddFarmOpen] = useState(false);
  const [tokenImages, setTokenImages] = useState<{ [key: string]: string }>({});
  const [activeTab, setActiveTab] = useState<TabOption>('MyLive');

  // Fetch token images from database
  const fetchTokenImages = async (): Promise<{ [key: string]: string }> => {
    try {
      const tokens = await tokenService.fetchAllTokens();
      const imageMap: { [key: string]: string } = {};
      
      tokens.forEach(token => {
        // Only use database image if it's valid, otherwise use Tinyman fallback
        const dbImage = token.image;
        if (isValidImageUrl(dbImage)) {
          imageMap[token.id.toString()] = dbImage;
        } else {
          // Use Tinyman as default if database image is invalid
          imageMap[token.id.toString()] = `https://asa-list.tinyman.org/assets/${token.id}/icon.png`;
        }
      });
      
      setTokenImages(imageMap);
      return imageMap;
    } catch (error) {
      console.error('Failed to fetch token images:', error);
      const emptyMap = {};
      setTokenImages(emptyMap);
      return emptyMap;
    }
  };

  const fetchAllFarms = async (images: { [key: string]: string } = {}) => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/farming/all`);
      const data = res.data?.data || [];
      const now = Math.floor(Date.now() / 1000);

      // Use database images with fallback to Tinyman
      const databaseImages = Object.keys(images).length > 0 ? images : tokenImages;
      
      const mapped = data
        .filter((farm: any) => {
          const isCreator = farm.creatorId === walletAddress;
          const isLive = farm.farmEndTime > now;

          switch (activeTab) {
            case 'Live':
              return !isCreator && isLive;
            case 'Ended':
              return !isCreator && !isLive;
            case 'MyLive':
              return isCreator && isLive;
            case 'MyEnded':
              return isCreator && !isLive;
            default:
              return true;
          }
        })
        .map((farm: any, index: number) => {
          const endsIn = Math.max(0, farm.farmEndTime - now);
          const endsInDays = Math.ceil(endsIn / 86400);

          const poolData = farm.totalStaked || 0;
          const tvl = `$${(poolData)}`; // Calculate TVL here

          // Get token IDs for LP tokens and reward token
          const tokenAId = farm.lpToken?.tokenAId?.toString() || farm.lpToken?.tokenA?.id?.toString();
          const tokenBId = farm.lpToken?.tokenBId?.toString() || farm.lpToken?.tokenB?.id?.toString();
          const rewardTokenId = farm.rewardToken?.id?.toString() || farm.rewardTokenId?.toString();

          // Use database images with fallback to Tinyman
          // Validate database images before using them
          const tokenADbImage = databaseImages[tokenAId];
          const tokenBDbImage = databaseImages[tokenBId];
          const rewardTokenDbImage = databaseImages[rewardTokenId];
          
          const tokenAImage = (tokenADbImage && isValidImageUrl(tokenADbImage))
            ? tokenADbImage
            : `https://asa-list.tinyman.org/assets/${tokenAId}/icon.png`;
          const tokenBImage = (tokenBDbImage && isValidImageUrl(tokenBDbImage))
            ? tokenBDbImage
            : `https://asa-list.tinyman.org/assets/${tokenBId}/icon.png`;
          const rewardTokenImage = (rewardTokenDbImage && isValidImageUrl(rewardTokenDbImage))
            ? rewardTokenDbImage
            : `https://asa-list.tinyman.org/assets/${rewardTokenId}/icon.png`;

          return {
            key: farm._id || index,
            _id: farm._id,
            pool: (
              <div className="flex items-center gap-[20px] w-[350px]">
                {/* Token Icons */}
                <div className="flex relative">
                  <img 
                    key={`tokenA-${tokenAId}-${tokenAImage}`}
                    src={tokenAImage} 
                    alt={farm.lpToken?.tokenA || 'Token A'} 
                    className="w-[40px] h-[40px] rounded-full drop-shadow-md" 
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const hasTriedFallback = target.dataset.fallbackAttempted === 'true';
                      if (!hasTriedFallback && !target.src.includes('tinyman.org')) {
                        target.dataset.fallbackAttempted = 'true';
                        target.src = `https://asa-list.tinyman.org/assets/${tokenAId}/icon.png`;
                      } else if (hasTriedFallback || target.src.includes('tinyman.org')) {
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI0U1RTlFQSIvPjxwYXRoIGQ9Ik0yMCAxMkMxNS41ODIyIDEyIDEyIDE1LjU4MjIgMTIgMjBDMTIgMjQuNDE3OCAxNS41ODIyIDI4IDIwIDI4QzI0LjQxNzggMjggMjggMjQuNDE3OCAyOCAyMEMyOCAxNS41ODIyIDI0LjQxNzggMTIgMjAgMTJaIiBmaWxsPSIjOUI5Q0E1Ii8+PC9zdmc+';
                      }
                    }}
                  />
                  <img 
                    key={`tokenB-${tokenBId}-${tokenBImage}`}
                    src={tokenBImage} 
                    alt={farm.lpToken?.tokenB || 'Token B'} 
                    className="w-[40px] h-[40px] rounded-full drop-shadow-md -ml-4 z-10" 
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const hasTriedFallback = target.dataset.fallbackAttempted === 'true';
                      if (!hasTriedFallback && !target.src.includes('tinyman.org')) {
                        target.dataset.fallbackAttempted = 'true';
                        target.src = `https://asa-list.tinyman.org/assets/${tokenBId}/icon.png`;
                      } else if (hasTriedFallback || target.src.includes('tinyman.org')) {
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI0U1RTlFQSIvPjxwYXRoIGQ9Ik0yMCAxMkMxNS41ODIyIDEyIDEyIDE1LjU4MjIgMTIgMjBDMTIgMjQuNDE3OCAxNS41ODIyIDI4IDIwIDI4QzI0LjQxNzggMjggMjggMjQuNDE3OCAyOCAyMEMyOCAxNS41ODIyIDI0LjQxNzggMTIgMjAgMTJaIiBmaWxsPSIjOUI5Q0E1Ii8+PC9zdmc+';
                      }
                    }}
                  />
                </div>

                {/* Text Information */}
                <div className="flex flex-col ml-[10px]">
                  <h6 className="text-black font-medium text-[14px]">{farm.lpToken?.tokenA} / {farm.lpToken?.tokenB}</h6>
                  <div className="flex items-center gap-2">
                    <img 
                      key={`reward-${rewardTokenId}-${rewardTokenImage}`}
                      src={rewardTokenImage} 
                      alt={farm.rewardToken?.id || 'Reward token'} 
                      className="w-[20px] h-[20px] rounded-full" 
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const hasTriedFallback = target.dataset.fallbackAttempted === 'true';
                        if (!hasTriedFallback && !target.src.includes('tinyman.org')) {
                          target.dataset.fallbackAttempted = 'true';
                          target.src = `https://asa-list.tinyman.org/assets/${rewardTokenId}/icon.png`;
                        } else if (hasTriedFallback || target.src.includes('tinyman.org')) {
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMCIgY3k9IjEwIiByPSIxMCIgZmlsbD0iI0U1RTlFQSIvPjxwYXRoIGQ9Ik0xMCA2QzguODk1NDMgNiA4IDYuODk1NDMgOCA4QzggOS4xMDQ1NyA4Ljg5NTQzIDEwIDEwIDEwQzExLjEwNDYgMTAgMTIgOS4xMDQ1NyAxMiA4QzEyIDYuODk1NDMgMTEuMTA0NiA2IDEwIDZaIiBmaWxsPSIjOUI5Q0E1Ii8+PC9zdmc+';
                        }
                      }}
                    />
                    <h6 className="text-green font-medium text-[14px]">{farm.rewardToken?.id}</h6>
                  </div>
                  <p className="text-gray-500 text-[12px]">
                    {farm.lockPeriod / 86400} {farm.lockPeriod / 86400 === 1 ? 'Day' : 'Days'} Lock
                  </p>
                </div>
              </div>
            ),
            tvl: tvl, // TVL value is displayed here
            apr: `${farm.aprRate}%`,
            staked: `$${(farm.totalStaked / 1_000_000).toFixed(2)}`,
            reward: (
              <div>
                {(farm.rewardTokenAmount / 1_000_000).toFixed(2)} {farm.rewardToken?.id}
              </div>
            ),
            ends: `${endsInDays} ${endsInDays === 1 ? 'day' : 'days'}`,
            farmStartTime: farm.farmStartTime,
            farmEndTime: farm.farmEndTime,
            appId: farm.appId,
          };
        });

      setFarms(mapped);
    } catch (error) {
      console.error('Error fetching farms:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchTokenImages();
      // Fetch farms after token images are loaded
      fetchAllFarms();
    };
    loadData();
  }, []);

  useEffect(() => {
    // Refetch farms when activeTab or walletAddress changes
    if (Object.keys(tokenImages).length > 0) {
      const timer = setTimeout(() => {
        fetchAllFarms();
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [activeTab, walletAddress]);
  
  // Refetch farms when tokenImages are updated (but not on initial empty state)
  useEffect(() => {
    if (Object.keys(tokenImages).length > 0 && farms.length > 0) {
      const timer = setTimeout(() => {
        fetchAllFarms();
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [tokenImages]);

  return (
    <div className="w-full mt-[40px] mb-[47px]">
    {walletAddress && <Farmbanner wallet={walletAddress} />}
      <div className="max-xxxl:w-[95%] w-[80%] m-auto flex flex-col gap-[16px]">
        {/* Tabs */}
        <div className="top flex max-md:flex-col justify-between items-center gap-[20px]">
          <div className="flex w-full justify-center md:justify-start">
            <div className="switcher flex flex-wrap justify-center md:flex-nowrap gap-[8px] p-[8px] bg-white rounded-[12px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)] overflow-x-auto max-w-full">
              {(['MyLive', 'MyEnded', 'Live', 'Ended', 'All'] as TabOption[]).map((tab) => (
                <p
                  key={tab}
                  className={`${activeTab === tab 
                    ? 'text-white linearGradient shadow-md' 
                    : 'text-black hover:bg-gray-50'
                  } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] px-[16px] min-w-[120px] h-[40px] text-[14px] whitespace-nowrap transition-all duration-200`}
                  onClick={() => setActiveTab(tab)}
                >
                  {{
                    MyLive: 'My Live Farms',
                    MyEnded: 'My Ended Farms',
                    Live: 'Live Farms',
                    Ended: 'Ended Farms',
                    All: 'All Farms',
                  }[tab]}
                </p>
              ))}
            </div>
          </div>

          {/* Create Button */}
          <div className="flex flex-col md:items-end gap-[14px] w-full">
            <div className="flex justify-center md:justify-end">
              <Button
                text="Create Farm"
                onClick={() => setIsAddFarmOpen(true)}
                img="ic:sharp-add"
                className="button btn-red-border w-[250px] md:w-[180px]"
                height={45}
                clr="text-red"
              />
            </div>
          </div>
        </div>

        <div className="w-full mt-1">
          <p className="text-sm text-gray-500">
            {{
              MyLive: 'Showing your live farming farms.',
              MyEnded: 'Showing your ended farming farms.',
              Live: 'Showing all live farms.',
              Ended: 'Showing all ended farms.',
              All: 'Showing all farming farms.',
            }[activeTab]}
          </p>
        </div>

        <div className="bottom">
          {!walletAddress ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-sm">
              <Icon icon="mdi:wallet-outline" className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Connect Your Wallet</h3>
              <p className="text-gray-500 text-center">Please connect your wallet to view farming pools and participate in farming.</p>
            </div>
          ) : farms.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-sm">
              <Icon icon="mdi:folder-open-outline" className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Farms Found</h3>
              <p className="text-gray-500 text-center">There are currently no farming pools available in this category.</p>
            </div>
          ) : (
            <FTable
              farms={farms}
              fetchData={fetchAllFarms}
              showExpandable={activeTab}
            />
          )}
        </div>
      </div>

      <AddFarmModal
        isaddFarmOpen={isAddFarmOpen}
        setisaddFarmOpen={setIsAddFarmOpen}
        fetchData={fetchAllFarms}
      />
    </div>
  );
};

export default FarmTable;
