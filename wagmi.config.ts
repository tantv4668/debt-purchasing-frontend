import { defineConfig } from '@wagmi/cli'
import { foundry } from '@wagmi/cli/plugins'

export default defineConfig({
  out: 'src/generated.ts',
  contracts: [],
  plugins: [
    foundry({
      project: '../debt-purchasing-contracts',
      include: [
        'AaveRouter.sol/**',
        'AaveDebt.sol/**',
        'IAaveRouter.sol/**',
        'IAaveDebt.sol/**',
      ],
      exclude: [
        'test/**',
        'script/**',
      ]
    }),
  ],
}) 