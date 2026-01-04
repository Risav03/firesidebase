export async function GET() {
  let header, payload, signature;
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://firesidebase.vercel.app";
  
  return Response.json({
    frame: {
      name: "Fireside",
      version: "1",
      iconUrl: `${baseUrl}/app-icon2.png`,
      homeUrl: baseUrl,
      imageUrl: `${baseUrl}/fireside_banner.png`,
      buttonTitle: "Tune in!",
      splashImageUrl: `${baseUrl}/app-icon.png`,
      splashBackgroundColor: "#000000",
      webhookUrl: `${baseUrl}/api/webhook`,
      subtitle: "Sparking conversations on Base",
      description: "The ultimate miniapp for connecting people.",
      primaryCategory: "entertainment",
      tags: ["social", "base", "calls", "spaces"],
      heroImageUrl: `${baseUrl}/app-icon2.png`,
      ogTitle: "Fireside"
    },
     accountAssociation: {
    header: "eyJmaWQiOjEzMTc5MDYsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg2QzI5OTI3Yzc3MWQ5NTc5ZDc4OEQ4MzBmYTBCMDEzNGYyMDQ5NDQzIn0",
    payload: "eyJkb21haW4iOiJmaXJlc2lkZWJhc2UudmVyY2VsLmFwcCJ9",
    signature: "XrvnA/vGmyjKGGag5/N83QXHLMRcrrzZtKqvRaXKgSw4S6YxKka212w5wrhwVPtbDLelUvOa3PaRl8impP5yHBw="
  },
  baseBuilder: {
    allowedAddresses: ["0x2E6bcE51aDCF88E58fe8276a210508D6c4085121", "0x3FF23652c47477B69B6b7bc90A79a515860b7165"]
  }
  });
}