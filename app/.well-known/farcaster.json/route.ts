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
      header: "eyJmaWQiOjExMjk4NDIsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHhBMTVkQzQxQjYwRjZmNzc5NjlDYzkzZjQxRUM3QjFkMzc2QTEzQjc5In0",
      payload: "eyJkb21haW4iOiJmaXJlc2lkZWJhc2UudmVyY2VsLmFwcCJ9",
      signature: "MHhhY2VkMjcyZWQ5OGRhYmUyOTU5ZjI3MmExM2UxNjdlMDM3NDQ2N2Q3Y2RlY2U3NGZlZDkxMjg2MmMxYjBlNzFkN2RmZGI5NGZiN2NjYzZiOWEwOWExMmU3Y2U4MDJkNDRjMjJiMTkwZGQzZDk1Y2I0NmIzMmJiMWYzODdiOTA0YjFi"
    }
  });
}