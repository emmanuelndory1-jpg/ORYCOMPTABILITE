import bcrypt from 'bcryptjs';
const password = 'admin123';
const hash = bcrypt.hashSync(password, 10);
const isValid = bcrypt.compareSync(password, hash);
console.log('Password:', password);
console.log('Hash:', hash);
console.log('Is Valid:', isValid);

// Test with a manually created hash from my local machine or similar if needed
// But here we just want to see if bcryptjs in this environment works as expected.
