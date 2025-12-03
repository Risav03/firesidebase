export async function fetchETHPrice(){
    try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );
        
        if (response.ok) {
          const ethData = await response.json();
          const ethPriceUsd = ethData?.ethereum?.usd;
          
          if (ethPriceUsd) {
            return ethPriceUsd;
          }
        } else {
          console.error('CoinGecko API error:', response.status, await response.text());
        }
      } catch (ethError) {
        console.error('Error fetching ETH price from CoinGecko:', ethError);
      }
}