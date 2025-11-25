export const topics = [
	'Base',
	'Ethereum',
	'NFTs',
	'Farcaster',
	'DeFi',
	'Gaming',
]

export const ADS_TESTER_FIDS = ['1129842', '1185279'];

export function isAdsTester(fid?: number | string | null) {
	if (fid === undefined || fid === null) return false;
	const fidStr = String(fid);
	return ADS_TESTER_FIDS.includes(fidStr);
}