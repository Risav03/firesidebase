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
		let user = await User.findOne({ fid }).select('fid username displayName pfp_url wallet topics hostedRooms coHostedRooms speakerRooms listenerRooms');
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

export async function PATCH(req: NextRequest) {
	try {
		await connectToDB();
		const fid = req.headers.get('x-user-fid');
		if (!fid) {
			return NextResponse.json({ error: 'Missing x-user-fid header' }, { status: 400 });
		}
		
		// Check for query parameter
		const searchParams = req.nextUrl.searchParams;
		const query = searchParams.get('query');
		
		// Handle refetch profile data case
		if (query === 'profile') {
			// Fetch latest user data from Neynar
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
			
			if (!neynarRes) {
				return NextResponse.json({ error: 'User not found in Neynar' }, { status: 404 });
			}
			
			// Find existing user to preserve wallet
			const existingUser = await User.findOne({ fid });
			if (!existingUser) {
				return NextResponse.json({ error: 'User not found' }, { status: 404 });
			}
			
			// Update user with latest data from Neynar, but preserve wallet
			const user = await User.findOneAndUpdate(
				{ fid },
				{ 
					username: neynarRes.username,
					displayName: neynarRes.display_name,
					pfp_url: neynarRes.pfp_url
				},
				{ new: true, select: 'fid username displayName pfp_url wallet topics' }
			);
			
			return NextResponse.json({ success: true, user });
		}
		
		// Handle regular update for topics and/or token
		const body = await req.json();
		const { topics, token } = body;
		
		// Create an update object with only the fields that were provided
		const updateObj: any = {};
		
		// Add topics to update if provided and valid
		if (topics !== undefined) {
			if (!Array.isArray(topics)) {
				return NextResponse.json({ error: 'Topics must be an array' }, { status: 400 });
			}
			updateObj.topics = topics;
		}
		
		// Add token to update if provided
		if (token !== undefined) {
			updateObj.token = token;
		}
		
		// If no valid fields to update, return an error
		if (Object.keys(updateObj).length === 0) {
			return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
		}
		
		const user = await User.findOneAndUpdate(
			{ fid },
			updateObj,
			{ new: true, select: 'fid username displayName pfp_url wallet topics token' }
		);
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}
		return NextResponse.json({ success: true, user });
	} catch (error: any) {
		return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
