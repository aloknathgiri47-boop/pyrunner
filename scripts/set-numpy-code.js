// Set numpy test code and run it
const code = [
  'import numpy as np',
  '',
  'a = np.array([1, 2, 3, 4, 5])',
  'b = np.array([10, 20, 30, 40, 50])',
  '',
  'print("Array a:", a)',
  'print("Array b:", b)',
  'print("a + b:", a + b)',
  'print("Mean of a:", np.mean(a))',
  'print("Sum of b:", np.sum(b))',
  'print("Dot product:", np.dot(a, b))',
].join('\n')

window.__projectStore.getState().setActiveFileContent(code)

// Click Run
const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run'))
if (btn) btn.click()

'done'
