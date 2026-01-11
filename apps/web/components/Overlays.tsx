import AdsOverlay from "./AdsOverlay";

export default function Overlays({ roomId }: { roomId: string }) {
    return(
        <div className="w-full flex-col gap-2">
            
            <AdsOverlay roomId={roomId} />
        </div>
    )
}