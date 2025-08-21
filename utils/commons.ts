export const getEthPrice = async () => {
  try {
    const url =
      "https://api.g.alchemy.com/prices/v1/CA4eh0FjTxMenSW3QxTpJ7D-vWMSHVjq/tokens/by-symbol?symbols=ETH";
    const headers = {
      Accept: "application/json",
    };

    const priceFetch = await fetch(url, {
      method: "GET",
      headers: headers,
    });

    const priceBody = await priceFetch.json();

    return priceBody.data[0].prices[0].value;
  } catch (error) {
    console.error("Error", error);
    throw error;
  }
};
