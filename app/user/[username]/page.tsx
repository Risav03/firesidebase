import User from '@/utils/schemas/User';
import Room from '@/utils/schemas/Room';
import Link from 'next/link';
import { IoIosArrowBack } from 'react-icons/io';

interface Props {
	params: { username: string };
}

export default async function UserProfilePage({ params }: Props) {
	const { username } = params;
	// Fetch user by username
	const user = await User.findOne({ username }).select('pfp_url displayName username hostedRooms');
	if (!user) {
		return <div className="text-center py-10 text-red-500">User not found</div>;
	}
	// Fetch hosted rooms
	const rooms = await Room.find({ host: user._id }).select('roomId name description topics status');

	return (
		<div className="max-w-2xl mx-auto p-4 text-white min-h-screen">
			<div className="mb-4 flex items-center">
				<Link href="/" className="mr-2 p-2 text-white bg-white/20 rounded-full"><IoIosArrowBack/></Link>
			</div>
			<div className="flex items-center gap-4 mb-6">
				<img src={user.pfp_url} alt={user.displayName} className="w-20 h-20 rounded-full object-cover border-2 border-pink-400" />
				<div>
					<div className="text-xl font-semibold">{user.displayName}</div>
					<div className="text-gray-400">@{user.username}</div>
				</div>
			</div>
			<div>
				<h2 className="text-lg font-semibold mb-2 text-gray-400">Hosted Rooms</h2>
				{rooms.length === 0 ? (
					<div className="text-gray-400">No rooms hosted yet.</div>
				) : (
					<ul className="space-y-3">
						{rooms.map((room: any) => (
							<li key={room.roomId} className="p-4 bg-gray-800 rounded-lg">
								<div className="font-bold text-white">{room.name}</div>
								<div className="text-gray-400 text-sm mb-1">{room.description}</div>
								<div className="text-xs text-pink-400 mb-1">Tags: {room.topics.join(', ')}</div>
								<div className="text-xs text-orange-400">Status: {room.status}</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
