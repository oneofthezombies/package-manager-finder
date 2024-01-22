import stylisticTs from '@stylistic/eslint-plugin-ts'
import parserTs from '@typescript-eslint/parser'

export default [
  {
    plugins: {
      '@stylistic/ts': stylisticTs,
    },
    parser: parserTs,
    rules: {
      '@stylistic/indent': ['error', 2],
      '@stylistic/semi': 'error',
      '@stylistic/quotes': ['error', 'single'],
    },
  },
]
