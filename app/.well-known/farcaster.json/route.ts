export async function GET() {
  let header, payload, signature;
  
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
    header: "eyJmaWQiOjEzMTc5MDYsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg3ZUU0MTQ1YUFiOGMwNjI0NmE0ZDQ2NEIzNmQ5ODdhOTA2MWRCQTFDIn0",
    payload: "eyJkb21haW4iOiJmaXJlc2lkZWJhc2UudmVyY2VsLmFwcCJ9",
    signature: "MHhjYThlNzllMGRlYjUxNjllZDZlN2RkZWI5OWFhOGM3M2M4ZWM5NWE4OTY1MzFiYzJmMWE5YWQzOWY1ZmNkMjZhMzFkYjgyODZkYjY1MzdmYTQyMDI0NDhjYTM1MzYyMDljYzAyMDlmZDJlNTU1ZDY1MDhhZTQ0ZTNiMWRjYWI1ODFi"
  }
  });
}