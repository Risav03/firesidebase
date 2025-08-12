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
			user = await User.create({ fid });
		}

		return NextResponse.json({ user });
	} catch (error: any) {
		return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
