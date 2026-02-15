// wallet.js

import {
  makeRandomPrivKey,
  getAddressFromPrivateKey
} from "@stacks/transactions";



export function generateWallet() {

  try {

    const privateKey = makeRandomPrivKey();

    const privateKeyHex = privateKey.data.toString("hex");

    const address = getAddressFromPrivateKey(
      privateKeyHex,
      "mainnet"
    );

    return {

      privateKey: privateKeyHex,
      address

    };

  } catch (error) {

    console.log(error);
    return null;

  }

}




export function importWallet(privateKeyHex) {

  try {

    const address = getAddressFromPrivateKey(
      privateKeyHex,
      "mainnet"
    );

    return {

      privateKey: privateKeyHex,
      address

    };

  } catch (error) {

    console.log(error);
    return null;

  }

}
