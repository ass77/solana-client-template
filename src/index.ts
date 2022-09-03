import * as Web3 from "@solana/web3.js";
import dotenv from "dotenv";
import * as fs from "fs";
dotenv.config();

const PROGRAM_ID = new Web3.PublicKey(
	"ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa"
);

const PROGRAM_DATA_PUBLIC_KEY = new Web3.PublicKey(
	"Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod"
);

/**
 * If the private key is not in the .env file, generate a new keypair, write it to the .env file, and
 * airdrop SOL to the new account. If the private key is in the .env file, use it to create a keypair,
 * and airdrop SOL to the account
 * @param connection - Web3.Connection - this is the connection to the blockchain.
 * @returns a promise that resolves to a Web3.Keypair.
 */
async function initKeyPair(connection: Web3.Connection): Promise<Web3.Keypair> {
	if (!process.env.PRIVATE_KEY) {
		const signer = Web3.Keypair.generate();
		fs.writeFileSync(".env", `PRIVATE_KEY=${signer.secretKey.toString()}`);

		await airdropSolIfNeeded(signer, connection);
		return signer;
	}

	const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[];
	const secretKey = Uint8Array.from(secret);
	const keyPairFromSecret = Web3.Keypair.fromSecretKey(secretKey);

	await airdropSolIfNeeded(keyPairFromSecret, connection);

	return keyPairFromSecret;
}

/**
 * If the account has less than 1 SOL, request an airdrop of 1 SOL and confirm the transaction
 * @param signer - The keypair that will be used to sign the transaction.
 * @param connection - The connection to the Solana cluster.
 */
async function airdropSolIfNeeded(
	signer: Web3.Keypair,
	connection: Web3.Connection
) {
	const balance = await connection.getBalance(signer.publicKey);

	console.log("Old Balance: ", balance / Web3.LAMPORTS_PER_SOL);

	if (balance / Web3.LAMPORTS_PER_SOL < 1) {
		console.log("Airdropping 1 SOL to ", signer.publicKey.toBase58());

		const airdropSignature = await connection.requestAirdrop(
			signer.publicKey,
			Web3.LAMPORTS_PER_SOL
		);

		const latestBlockhash = await connection.getLatestBlockhash();

		await connection.confirmTransaction({
			blockhash: latestBlockhash.blockhash,
			lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
			signature: airdropSignature,
		});
	}

	const newBalance = await connection.getBalance(signer.publicKey);
	console.log("New Balance: ", newBalance / Web3.LAMPORTS_PER_SOL);
}

/**
 * `pingProg` creates a transaction that calls the `ping` function of the `ping` program
 * @param conenction - Web3.Connection - The connection to the Solana cluster
 * @param payer - The keypair of the account that will pay for the transaction.
 */
async function pingProg(conenction: Web3.Connection, payer: Web3.Keypair) {
	const transaction = new Web3.Transaction();

	const instruction = new Web3.TransactionInstruction({
		keys: [
			{ pubkey: PROGRAM_DATA_PUBLIC_KEY, isSigner: false, isWritable: true },
		],
		programId: PROGRAM_ID,
	});

	transaction.add(instruction);

	const transactionSignature = await Web3.sendAndConfirmTransaction(
		conenction,
		transaction,
		[payer]
	);

	console.log(
		`Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
	);
}

async function main() {
	const connection = new Web3.Connection(Web3.clusterApiUrl("devnet"));
	const signer = await initKeyPair(connection);

	console.log("Signer: ", signer.publicKey.toBase58());

	await pingProg(connection, signer);
}

main()
	.then(() => {
		console.log("Finished successfully");
		process.exit(0);
	})
	.catch((error) => {
		console.log(error);
		process.exit(1);
	});
