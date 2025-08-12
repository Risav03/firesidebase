import { NextRequest, NextResponse } from 'next/server';
import User from '../../../../utils/schemas/User';
import { connectToDB } from '@/utils/db';

export async function POST(req: NextRequest) {
	try {
		console.log("Handling user creation...");
		await connectToDB();
		// Get fid from x-user-fid header
		const fid = req.headers.get('x-user-fid');
		console.log("User fid", fid);
		if (!fid) {
			return NextResponse.json({ error: 'Missing x-user-fid header' }, { status: 400 });
		}

		// Try to find the user
		let user = await User.findOne({ fid });
		if (!user) {

			const res = await fetch(
				`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
				{
					headers: {
						"x-api-key": process.env.NEYNAR_API_KEY as string,
					},
				}
			);
			console.log("This is the raw response:", res);
			if (!res.ok) {
				return NextResponse.json(
					{ error: "Error fetching user from external API" },
					{ status: res.status }
				);
			}
			const jsonRes = await res.json();
			console.log("This is the json response:", jsonRes);
			const neynarRes = jsonRes.users?.[0];

			user = await User.create({ fid: fid, username: neynarRes?.user.username, displayName: neynarRes?.user.displayName, pfp_url: neynarRes?.user.pfp_url });
		}

		return NextResponse.json({ user });
	} catch (error: any) {
		return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
