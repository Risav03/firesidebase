export async function GET() {
  let header, payload, signature;
  try {
    header = process.env.FARCASTER_HEADER ? JSON.parse(process.env.FARCASTER_HEADER) : null;
    payload = process.env.FARCASTER_PAYLOAD ? JSON.parse(process.env.FARCASTER_PAYLOAD) : null;
    signature = process.env.FARCASTER_SIGNATURE ? JSON.parse(process.env.FARCASTER_SIGNATURE) : null;

    console.log("Farcaster env variables:", { header, payload, signature });
  } catch (e) {
    header = process.env.FARCASTER_HEADER;
    payload = process.env.FARCASTER_PAYLOAD;
    signature = process.env.FARCASTER_SIGNATURE;
  }
  return Response.json({
    frame: {
      name: "Fireside",
      version: "1",
      iconUrl: "https://firesidebase.vercel.app/app-icon2.png",
      homeUrl: "https://firesidebase.vercel.app",
      imageUrl: "https://firesidebase.vercel.app/fireside_banner.png",
      buttonTitle: "Tune in!",
      splashImageUrl: "https://firesidebase.vercel.app/app-icon.png",
      splashBackgroundColor: "#000000",
      webhookUrl: "https://firesidebase.vercel.app/api/webhook",
      subtitle: "Sparking conversations on Base",
      description: "The ultimate miniapp for connecting people.",
      primaryCategory: "social",
      tags: ["social", "base", "calls", "spaces"],
      heroImageUrl: "https://firesidebase.vercel.app/app-icon2.png",
      ogTitle: "Fireside"
    },
    accountAssociation: {
      header,
      payload,
      signature
    }
  });
}