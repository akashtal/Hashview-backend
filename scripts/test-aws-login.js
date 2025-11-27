const axios = require('axios');

const API_URL = 'http://hashview-app-env.eba-jgfmuizj.eu-west-2.elasticbeanstalk.com/api';
const EMAIL = 'djtalukdar290@gmail.com';
const PASSWORD = 'Akashtal';

async function testLogin() {
    try {
        console.log(`Attempting login for ${EMAIL} at ${API_URL}...`);

        const response = await axios.post(`${API_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });

        console.log('✅ Login Successful!');
        console.log('User ID:', response.data.user._id);
        console.log('Name:', response.data.user.name);
        console.log('Token:', response.data.token ? 'Received' : 'Missing');

    } catch (error) {
        console.error('❌ Login Failed');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testLogin();
