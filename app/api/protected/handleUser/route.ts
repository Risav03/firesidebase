import { NextRequest, NextResponse } from 'next/server';
import User from '../../../../utils/schemas/User';
import { connectToDB } from '@/utils/db';

export async function POST(req: NextRequest) {
	try {
		await connectToDB();
		// Get fid from x-user-fid header
		const fid = req.headers.get('x-user-fid');

		if (!fid) {
			return NextResponse.json({ error: 'Missing x-user-fid header' }, { status: 400 });
		}

		console.log("Fetching user with fid:", fid);

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
			if (!res.ok) {
				return NextResponse.json(
					{ error: "Error fetching user from external API" },
					{ status: res.status }
				);
			}
			const jsonRes = await res.json();
			const neynarRes = jsonRes.users?.[0];

			console.log("Neynar response:", neynarRes);

			user = await User.create({ fid: fid, username: neynarRes?.username, displayName: neynarRes?.display_name, pfp_url: neynarRes?.pfp_url, wallet: neynarRes?.verified_addresses?.primary?.eth_address || neynarRes?.custody_address });

			console.log("Created new user:", user);
		}

		return NextResponse.json({ user });
	} catch (error: any) {
		return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
