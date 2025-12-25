import GameWrapper from '@/components/GameWrapper';

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full h-full">
        <GameWrapper />
      </div>
    </div>
  );
}
