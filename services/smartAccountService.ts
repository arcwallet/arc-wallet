import { JsonRpcProvider, Wallet, ContractFactory, Contract, type Provider, type Signer } from 'ethers';
import artifact from '../artifacts/ArcSmartAccount.json' assert { type: 'json' };
import { getArcRpcUrl } from '../config/rpc';

const RPC_URL = getArcRpcUrl();
const ENTRY_POINT = import.meta.env.VITE_ARC_ENTRY_POINT ?? '0x0000000000000000000000000000000000000000';

const getProvider = () => new JsonRpcProvider(RPC_URL);
const { abi, evm } = artifact as { abi: any; evm: { bytecode: { object: string } } };

export const ARC_SMART_ACCOUNT_ABI = abi;
export const ARC_SMART_ACCOUNT_BYTECODE = evm.bytecode.object;

const getSmartAccountInstance = (address: string, runner?: Provider | Signer) =>
  new Contract(address, ARC_SMART_ACCOUNT_ABI, runner ?? getProvider());

export async function deploySmartAccount(sessionPrivateKey: string, ownerAddress: string): Promise<string> {
  const provider = getProvider();
  const wallet = new Wallet(sessionPrivateKey, provider);
  const factory = new ContractFactory(ARC_SMART_ACCOUNT_ABI, ARC_SMART_ACCOUNT_BYTECODE, wallet);
  const contract = await factory.deploy(ENTRY_POINT, ownerAddress);
  await contract.waitForDeployment();
  return await contract.getAddress();
}

export async function authorizeSessionKey(params: {
  signerPrivateKey: string;
  smartAccountAddress: string;
  sessionAddress: string;
  expiresAtSeconds: number;
}) {
  const provider = getProvider();
  const wallet = new Wallet(params.signerPrivateKey, provider);
  const contract = getSmartAccountInstance(params.smartAccountAddress, wallet);
  const tx = await contract.authorizeSessionKey(
    params.sessionAddress,
    BigInt(params.expiresAtSeconds),
  );
  await tx.wait();
}

export async function readSmartAccountOwner(address: string): Promise<string> {
  const contract = getSmartAccountInstance(address);
  return contract.owner() as Promise<string>;
}

export async function isSessionKeyAuthorised(
  smartAccountAddress: string,
  sessionKeyAddress: string,
): Promise<{ authorised: boolean; expiresAt: bigint }> {
  const contract = getSmartAccountInstance(smartAccountAddress);
  const [authorised, expiresAt] = (await contract.isSessionKeyAuthorised(
    sessionKeyAddress,
  )) as [boolean, bigint];
  return { authorised, expiresAt };
}

export const getSmartAccountContract = (address: string, runner?: Provider | Signer) =>
  getSmartAccountInstance(address, runner);
