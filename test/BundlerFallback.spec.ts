import chai from 'chai';
import sinon from 'sinon';
import { executeSmartAccountTransferWithFallback } from '../services/executionRouter.ts';

const { expect } = chai;

describe('executeSmartAccountTransferWithFallback', () => {
  const params = {
    sessionPrivateKey: '0x01',
    smartAccountAddress: '0x02',
    to: '0x03',
    amount: '1.0',
  };

  it('returns user operation hash when bundler succeeds', async () => {
    const result = await executeSmartAccountTransferWithFallback({
      ...params,
      forceBundler: true,
      bundlerExecutor: async () => ({ userOpHash: '0xdead' }),
      directExecutor: async () => {
        throw new Error('Should not hit direct executor');
      },
    });
    expect(result).to.deep.equal({ kind: 'userOp', hash: '0xdead' });
  });

  it('falls back to transaction when bundler throws', async () => {
    const warnSpy = sinon.stub(console, 'warn');
    const result = await executeSmartAccountTransferWithFallback({
      ...params,
      forceBundler: true,
      bundlerExecutor: async () => {
        throw new Error('Bundler failure');
      },
      directExecutor: async () => '0xbeef',
    });
    expect(result).to.deep.equal({ kind: 'transaction', hash: '0xbeef' });
    expect(warnSpy.calledOnce).to.equal(true);
    warnSpy.restore();
  });

  it('skips bundler when not configured', async () => {
    let bundlerCalled = false;
    const result = await executeSmartAccountTransferWithFallback({
      ...params,
      forceBundler: false,
      bundlerAvailability: () => false,
      bundlerExecutor: async () => {
        bundlerCalled = true;
        return { userOpHash: '0x123' };
      },
      directExecutor: async () => '0xabcd',
    });
    expect(bundlerCalled).to.equal(false);
    expect(result).to.deep.equal({ kind: 'transaction', hash: '0xabcd' });
  });
});
