import { ethers } from "ethers";
import { base } from "viem/chains";

// export async function writeNewContractSetup(
//   contractAddress: string,
//   abi: any,
//   wallet: any
// ) {
//   try {
//     await wallet.switchChain(base.id);
//     const provider = await wallet.getEthereumProvider();
//     const ethersProvider = new ethers.BrowserProvider(provider);
//     const signer = await ethersProvider.getSigner();

//     const auctionContract = new ethers.Contract(contractAddress, abi, signer);
//     return auctionContract;
//   } catch (error) {
//     console.error("Error setting up contract:", error);
//   }
// }

export async function readContractSetup(contractAddress: string, abi: any) {
  try {
    const provider = new ethers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_RPC_URL
    );

    const contract = new ethers.Contract(contractAddress, abi, provider);
    return contract;
  } catch (error) {
    console.error("Error setting up contract:", error);
  }
}
