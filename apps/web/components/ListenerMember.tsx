import { ScrollingName } from "./experimental";
import {
  useHMSStore,
  selectHasPeerHandRaised,
} from "@100mslive/react-sdk";

interface ListenerMemberProps {
  id: string;
  name: string;
  img?: string;
  onClick: (id: string) => void;
}

export default function ListenerMember({ id, name, img, onClick }: ListenerMemberProps) {
  const isHandRaised = useHMSStore(selectHasPeerHandRaised(id));

  return (
    <div 
      className="flex flex-col items-center gap-2 cursor-pointer" 
      onClick={() => onClick(id)}
    >
      <div
        className="rounded-full overflow-hidden relative"
        style={{
          width: '48px',
          height: '48px',
        }}
      >
        <img
          src={img || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`}
          alt={name}
          className="w-full h-full object-cover"
        />
        {isHandRaised && (
          <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-fireside-orange border-[1px] border-white">
            <span className="text-white text-xs">✋</span>
          </div>
        )}
      </div>
      <ScrollingName 
        name={name}
        className="text-[10px] w-full text-center" 
        style={{ color: 'rgba(255,255,255,.65)' }}
      />
    </div>
  );
}
