import { contrastText, validBackground, CREAM } from './readable-theme';

it('chooses readable ink for light, dark and orange backgrounds', () => {
  expect(contrastText('#ffffff')).toBe('#000000');
  expect(contrastText('#000000')).toBe('#ffffff');
  expect(contrastText('#ff9a3c')).toBe('#000000');
  expect(contrastText('#777777')).toBe('#000000');
  expect(validBackground('invalid')).toBe(CREAM);
});
