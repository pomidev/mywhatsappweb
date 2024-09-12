const express = require('express')
const qrcode = require('qrcode-terminal');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const date = require('date-and-time')
const otpGenerator = require('otp-generator')
const axios = require('axios')
const { Client, LocalAuth, WebCache, MessageMedia } = require('whatsapp-web.js');
const app = express();
app.use(bodyParser.json());


client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-gpu', ],
    },
//    webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html', }
      webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1014580163-alpha.html' }
 
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.initialize();

app.post('/wa-send/:wanumber', async(req,resp) =>{
	
		if(req.params.wanumber!=''){
			const number = req.params.wanumber;
			const sanitized_number = number.toString().replace(/[- )(]/g, ""); // remove unnecessary chars from the number
			const final_number = `62${sanitized_number.substring(sanitized_number.length)}`; 
			try {
				const number_details = await client.getNumberId(number); // get mobile number details
				let msgToSend = req.body.message;
				if (number_details) {
					try{
						const sendMessageData = await client.sendMessage(number_details._serialized, msgToSend); // send message
						console.log(sendMessageData);
						resp.json({"result":"success", "message":"WA message sent!", "data":sendMessageData});
						//process.exit(0);
					} catch (err){
						console.log(err.message);
						resp.json({"result":"error","message":err.message});
						//process.exit(2);
					}
				} else {
					console.log(final_number, "Mobile number is not registered");
					resp.json({"result":"success","message":"Mobile number is not registered","data":null});
					
				}
			} catch (err){
				console.log(err.message);
				resp.json({"result":"error","message":err.message,"data":null});
				//process.exit(1);
			}
			

		}
	

});






// Mulai server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`WA service app listening at http://localhost: ${PORT}`);
});