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


// Load modules
//import PoolManager from 'mysql-connection-pool-manager';
	// Define the pool
	const con  = mysql.createPool({
		connectionLimit : 200,
		host: "localhost",
		user: "wabotadm",
		password: "",
		database: "app_wabot",
	});

const mySqlConf = {
	host: "localhost",
	user: "wabotadm",
	password: "",
	database: "app_wabot",
	port:'3306'
}
const API_KEY = '';
const API_ENDPOINT = 'https://api.openai.com/v1/completions';


async function generateText(prompt) {
  try {
	const response = await axios.post(API_ENDPOINT, {
	  prompt: prompt,
	  model: 'text-davinci-003',
	  max_tokens:512,
	  temperature: 0.2
	}, {
	  headers: {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${API_KEY}`
	  }
	});
	return response.data.choices[0].text;
  } catch (error) {
	console.error(error);
  }
}





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

client.on('message_create', async message => {
    if (message.body === 'show') {
        // send back "pong" to the chat the message was sent in
        //const media = await MessageMedia.fromFilePath('capturedetection/image_2024-05-02_13-57-40.png');
        const media = await MessageMedia.fromFilePath('image_temp/send_image.png');
        const chat = await message.getChat();
        chat.sendMessage(media);

        //client.sendMessage(message.from, 'pong');
    }
});


client.on('message', async (msg) => {
	//-- init 
	let cmdString ="";
	let cmdStage=0;
	let nextStage=0;
	let expStage=-1;
	let prevStage=-1;
	let sqlinsert = "";
	let sqlupdate='';
	let chatrec={};
	let reqcount={};
	let cmdSeq='';
	let totalFail=0;
	let cmdSeqs=[];
	
	const botName ='Hesti';

	//-- prevent another message type, disturbing the script (i.e. wa status, sticker  etc can broke these script )
	if(msg.type==='chat'){
		let msgBody = msg.body.toUpperCase();
		let isCommand = false;
		
		let ts_hms = new Date();
		const dateval = date.format(ts_hms,"YYYY-MM-DD HH:mm:ss");
		
		//--- TO DO:
		/**
		* 1. check current message is the continuation of the previouse command (query to mysql, get latest chat_id and check whether it is a command or not)
		* 2. if current msg is a continuation of command, do stuff for that command, otherwise skip it 
		* 3. if not command, just say hello or skip
		**/
		try{
			await con.query("SELECT * FROM chatthread where `from`='"+msg.from+"' and is_command=1 and status=0 and id = (select max(id) from chatthread ct where ct.`from`='"+msg.from+"' ) ", function (err, result, fields) {
				if (err) {
					console.log(err);
				} else {
					console.log(result);
					if(result.length==1){
						chatrec = result[0];
						prevStage = chatrec.cmd_stage;
						cmdStage = chatrec.cmd_stage+1;  // current stage after last stage
						expStage = chatrec.next_stage;  //expected state from previous command
						cmdSeq = typeof chatrec.cmd_seq ==='undefined'?'':chatrec.cmd_seq;  //last cmd sequence
						totalFail= chatrec.fail_count;
						cmdSeqs = cmdSeq?.split(" ");  //get list of command sequence
					} else {
						cmdStage=0;
						expStage=-1;
						prevStage=-1;
						cmdSeq='';
						totalFail=0;
						cmdSeqs=[];
					}
				}
			});
		} catch (err){
			console.log(err);
		}
		
		await con.query("SELECT * FROM requestcounter where `from`='"+msg.from+"'" , function (err, result, fields) {
			if (err) {
				console.log(err);
			} else {
				console.log(result);
				if(result.length==1){
					reqcount = result[0];					
				} 
			}
			
		});
		
		const chat = await msg.getChat();
		const contact = await msg.getContact();
		const isQuotedMsg = msg.hasQuotedMsg;
		let quotedMsg = null;
		if(msg.hasQuotedMsg ){
				console.log(msg.body);
				
				quotedMsg = msg.rawQuotedMsg;
				console.log('quotedMsg is:'+quotedMsg);
		}
		//console.log(msg);
		console.log(` this message id is ${msg.id.id} and  from ${msg.from} and to ${msg.to}  and cmd stage ${cmdStage}`);
		
		if(Object.keys(reqcount).length !== 0 ){
			if(reqcount.block==1){
				msg.reply('Your phone number has been blocked!');
				cmdStage=-1;  //prvent next code to be executed.
			}
		}
		if(cmdStage==0){  // the very first message received 
		
			//--- has quotedmsg? 
			if(isQuotedMsg){
				//let quotedMsgBody = quotedMsg.getBody().toUpperCase();
				//--- if current message is a replied message from Hesti, is this SDP Ticket previously sent?
				//--- format ticket msg: "Request Assigned : ##RE-"
				//if(quotedMsgBody.substring(0,23)=='REQUEST ASSIGNED : ##RE-'){ //--- current quotedmsg is a SDP ticket
				//	console.log(` this message id is ${msg.id.id} and  from ${msg.from} and to ${msg.to}  and cmd stage ${cmdStage} and this is a ticket reply!!!!`);
				//}
				
			} else { 
				// do the others thing ...
				console.log(` fail ${msg.id.id} and  from ${msg.from} and to ${msg.to}  and cmd stage ${cmdStage} and ${msg.quotedMsg.body}`);
			}
			
			if(msgBody === '9') {
				cmdString='SAY-HELLO';
				isCommand = true;
				nextStage=1;  //next stage expected
				sqlinsert = "INSERT INTO chatthread(`chat_id`,`from`, `last_message`,`is_command`,`cmd_stage`,`next_stage`,`status`,`record_date`,`timestamp`,`cmd_seq`)  ";
				let sqlvalues = ` VALUES('${msg.id.id}','${msg.from}','${msgBody}',${isCommand},0,${nextStage},0,'${dateval}',${msg.timestamp},'${cmdString}')`;
				await con.query(sqlinsert+sqlvalues);
				await chat.sendMessage(`Hi @${contact.id.user}, apa yang bisa ${botName} bantu? `,{mentions: [contact]});
			}
			if(msgBody==='7'){ //-- other problem, by chat it support
				if(isWorkingHour(ts_hms)){
					cmdString='IT-SUPPORT';
					isCommand = true;
					nextStage=1;  //next stage expected
					sqlinsert = "INSERT INTO chatthread(`chat_id`,`from`, `last_message`,`is_command`,`cmd_stage`,`next_stage`,`status`,`record_date`,`timestamp`,`cmd_seq`)  ";
					let sqlvalues = ` VALUES('${msg.id.id}','${msg.from}','${msgBody}',${isCommand},0,${nextStage},0,'${dateval}',${msg.timestamp},'${cmdString}')`;
					await con.query(sqlinsert+sqlvalues);
					msg.reply('Saat ini Anda dalam antrian. Mohon tunggu beberapa saat. IT Helpdesk kami akan merespon chat Anda.\n Terimakasih ');
					//--- create task queue to reminder itsupport for this chat request
					sqlinsert = "INSERT INTO taskqueue(`command`,`params`, `otp`,`requester`,`status`,`record_date`)  ";
					sqlvalues = ` VALUES('${cmdString}','${msgBody}','','${msg.from}',0,'${dateval}')`;
					await con.query(sqlinsert+sqlvalues);
				} else {
					isCommand = true;
					nextStage=0;  //next stage expected
					msg.reply('Layanan Chat dengan IT-Support hanya berlaku di hari dan jam kerja, silahkan pilih menu *5. Buat Tiket* untuk menyampaikan permasalahan terkait IT.\n Terimakasih ');
				}
			}
			if(msgBody==='6'){ //-- other problem, just type and we'll create a ticket to IT
				cmdString='GENERAL-SUPPORT';
				isCommand = true;
				nextStage=1;  //next stage expected
				sqlinsert = "INSERT INTO chatthread(`chat_id`,`from`, `last_message`,`is_command`,`cmd_stage`,`next_stage`,`status`,`record_date`,`timestamp`,`cmd_seq`)  ";
				let sqlvalues = ` VALUES('${msg.id.id}','${msg.from}','${msgBody}',${isCommand},0,${nextStage},0,'${dateval}',${msg.timestamp},'${cmdString}')`;
				await con.query(sqlinsert+sqlvalues);
				msg.reply('Silahkan tuliskan permasalahan yang Anda hadapi, '+botName+' dan tim berusaha menyelesaikannya.\n Terimakasih ');
			}
			if(msgBody==='5'){ //-- other problem, just type and we'll create a ticket to IT
				cmdString='CREATE-TICKET';
				isCommand = true;
				nextStage=1;  //next stage expected
				sqlinsert = "INSERT INTO chatthread(`chat_id`,`from`, `last_message`,`is_command`,`cmd_stage`,`next_stage`,`status`,`record_date`,`timestamp`,`cmd_seq`)  ";
				let sqlvalues = ` VALUES('${msg.id.id}','${msg.from}','${msgBody}',${isCommand},0,${nextStage},0,'${dateval}',${msg.timestamp},'${cmdString}')`;
				await con.query(sqlinsert+sqlvalues);
				msg.reply('Silahkan tuliskan permasalahan yang Anda hadapi, '+botName+' dan tim berusaha menyelesaikannya.\n Terimakasih ');
			}
			if(msgBody==='4'){
				cmdString = 'APP-HOW-TO';
				isCommand = false;
				msg.reply('Mohon Maaf, fitur ini sedang '+botName+' upayakan agar segera tersedia,\n Silahkan coba lain waktu');
			}
			
			if(msgBody ==='3'){
				cmdString = 'ACCOUNT-INFO';
				isCommand = true;
				nextStage=1;  //next stage expected
				sqlinsert = "INSERT INTO chatthread(`chat_id`,`from`, `last_message`,`is_command`,`cmd_stage`,`next_stage`,`status`,`record_date`,`timestamp`,`cmd_seq`)  ";
				let sqlvalues = ` VALUES('${msg.id.id}','${msg.from}','${msgBody}',${isCommand},0,${nextStage},0,'${dateval}',${msg.timestamp},'${cmdString}')`;
				await con.query(sqlinsert+sqlvalues);
				msg.reply('Balas pesan berikut dengan memasukkan nomor BN Anda (contoh: hest0001)');
			}
			
			if(msgBody === '2') {
				cmdString='RESET-PASSWORD';
				isCommand = true;
				nextStage=1;  //next stage expected
				sqlinsert = "INSERT INTO chatthread(`chat_id`,`from`, `last_message`,`is_command`,`cmd_stage`,`next_stage`,`status`,`record_date`,`timestamp`,`cmd_seq`)  ";
				let sqlvalues = ` VALUES('${msg.id.id}','${msg.from}','${msgBody}',${isCommand},0,${nextStage},0,'${dateval}',${msg.timestamp},'${cmdString}')`;
				await con.query(sqlinsert+sqlvalues);
				msg.reply('Balas pesan berikut dengan memasukkan nomor BN Anda (contoh: hest0001)');
			}
			
			if(msgBody === '1') {
				cmdString='UNLOCK-ACCOUNT';
				isCommand = true;
				nextStage=1;  //next stage expected
				sqlinsert = "INSERT INTO chatthread(`chat_id`,`from`, `last_message`,`is_command`,`cmd_stage`,`next_stage`,`status`,`record_date`,`timestamp`,`cmd_seq`)  ";
				let sqlvalues = ` VALUES('${msg.id.id}','${msg.from}','${msgBody}',${isCommand},0,${nextStage},0,'${dateval}',${msg.timestamp},'${cmdString}') `;
				await con.query(sqlinsert+sqlvalues);
				msg.reply('Balas pesan berikut dengan memasukkan nomor BN Anda (contoh: hest0001)');
			}
		}
		
		if(!isCommand && (cmdStage==0 || cmdStage!=expStage )){  //--- is not command and cmdStage=0,  or is not command and current stage <> expected stage, it will be a missing step happen
			await chat.sendMessage(`Halo @${contact.id.user} \n Terima kasih telah menghubungi. Saya ${botName} (Helpdesk IT) PT. POMI.\n Silahkan ketik *Nomor* menu berikut:\n1. Unlock Account\n2. Reset Password \n \n5. Buat Tiket   \n6. B2B & e-Procurement Support \n Terimakasih`, {
				mentions: [contact]
			});
		} 
		
		if(!isCommand && cmdStage>0){  //is not command but cmdStage>0, it will be a continuation of command message, check the stage
		
		  console.log('ok '+ msgBody.substring(4)+ ' - ' + msgBody.substring(0,4));
		  
		  
		  //--- check command stage is correct sequential with the next step (expected step)? 
			if(cmdStage== expStage){
				//if command xxx then if stage xx
				if(cmdSeqs[0]==='UNLOCK-ACCOUNT' || cmdSeqs[0]==='RESET-PASSWORD' || cmdSeqs[0]==='ACCOUNT-INFO'){
					if(cmdStage==1){
						  if(!msgBody.isbn()){
								if(totalFail>=3){
									msg.reply('Format nomor BN yang diinputkan tidak valid, dan Anda telah melakukan kekeliruan sebanyak 3x,\n Mohon maaf, permintaan Anda dibatalkan');
									sqlupdate = `update chatthread set status=9 where id=${chatrec.id}`;
									await con.query(sqlupdate);
								} else {	
									msg.reply('Format nomor BN yang diinputkan tidak valid, silahkan coba kembali!');
									sqlupdate = `update chatthread set fail_count=fail_count+1 where id=${chatrec.id}`;
									await con.query(sqlupdate);
								}
						  } else {
								//stage 1 successful complete, continue to next 1
								//update last chat record status
								cmdSeq += ' '+msgBody;
								//concat(cmd_seq,'${chatrec.cmd_seq}')
								sqlupdate = `update chatthread set status=9, cmd_seq='${cmdSeq}' where id=${chatrec.id}`;
								await con.query(sqlupdate);
								//to do check current BN is registered in db if not rejected
								
								//to do , send next request to validation of the request, record this as new command 
								let otp = otpGenerator.generate(6, { specialChars: false });
								sqlinsert = "INSERT INTO chatthread(`chat_id`,`from`, `last_message`,`is_command`,`cmd_stage`,`next_stage`,`status`,`record_date`,`timestamp`,`otp`,`cmd_seq`)  ";
								nextStage = expStage+1;
							  
								let sqlvalues = ` VALUES('${msg.id.id}','${msg.from}','${msgBody}',1,${cmdStage},${nextStage},0,'${dateval}',${msg.timestamp},'${otp}','${cmdSeq}')`;
								await con.query(sqlinsert+sqlvalues);
								
								msg.reply('Silahkan informasikan tanggal lahir Anda dalam format DD/MM/YYYY (contoh: 31/12/1990)');
						  }
					}
					if(cmdStage==2){  //date of birth check
						const userKeyRegExp = /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}?$/;

						const valid = userKeyRegExp.test(msgBody);
						
						console.log(valid);
						if(valid){
							cmdSeq += ' '+msgBody;
							//stage 2 successful complete, continue to next 1
							//update last chat record status
							sqlupdate = `update chatthread set status=9, cmd_seq='${cmdSeq}' where id=${chatrec.id}`;
							await con.query(sqlupdate);
							msg.reply('Terimakasih, saya akan menginformasikan kembali setelah permintaan anda kami verifikasi');
							//--- create task queue
							sqlinsert = "INSERT INTO taskqueue(`command`,`params`, `otp`,`requester`,`status`,`record_date`)  ";
							let sqlvalues = ` VALUES('${cmdSeq}','${cmdSeq}','${chatrec.otp}','${chatrec.from}',0,'${dateval}')`;
							await con.query(sqlinsert+sqlvalues);
							
							//--- create/update request counter
							if(Object.keys(reqcount).length === 0){ 
								sqlinsert = "INSERT INTO requestcounter(`from`,`count`, `block`,`last_req`)  ";
								let sqlvalues = ` VALUES('${chatrec.from}',1,0,'${dateval}')`;
								await con.query(sqlinsert+sqlvalues);
							} else {
								sqlupdate = "update requestcounter set count=count+1 where `from`='"+chatrec.from+"'";
								await con.query(sqlupdate);
							}
							
						} else {
							if(totalFail>=3){
								msg.reply('Format tanggal lahir yang diinputkan tidak valid, dan Anda telah melakukan kekeliruan sebanyak 3x,\n Mohon maaf, permintaan Anda dibatalkan');
								sqlupdate = `update chatthread set status=9 where id=${chatrec.id}`;
								await con.query(sqlupdate);
							} else {
								msg.reply('Format tanggal lahir tidak sesuai, silahkan coba kembali!');
								sqlupdate = `update chatthread set fail_count=fail_count+1 where id=${chatrec.id}`;
								await con.query(sqlupdate);
							}
						}
						
					}
				}
				
				if(cmdSeqs[0]==='CREATE-TICKET'){
					if(cmdStage==1){
						cmdSeq += ' '+msgBody;
						//concat(cmd_seq,'${chatrec.cmd_seq}')
						sqlupdate = `update chatthread set status=9, cmd_seq='${cmdSeqs[0]}' where id=${chatrec.id}`;
						await con.query(sqlupdate);
						//to do check current BN is registered in db if not rejected
						msg.reply('Terimakasih, pesan Anda akan segera Hesti sampaikan kepada tim');
						
						//--- create task queue
						sqlinsert = "INSERT INTO taskqueue(`command`,`params`, `otp`,`requester`,`status`,`record_date`)  ";
						let sqlvalues = ` VALUES('${cmdSeqs[0]}','${msgBody}','${chatrec.otp}','${chatrec.from}',0,'${dateval}')`;
						await con.query(sqlinsert+sqlvalues);
						
						//--- create/update request counter
						if(Object.keys(reqcount).length === 0){ 
							sqlinsert = "INSERT INTO requestcounter(`from`,`count`, `block`,`last_req`)  ";
							let sqlvalues = ` VALUES('${chatrec.from}',1,0,'${dateval}')`;
							await con.query(sqlinsert+sqlvalues);
						} else {
							sqlupdate = "update requestcounter set count=count+1 where `from`='"+chatrec.from+"'";
							await con.query(sqlupdate);
						}
					}
					
				}
				
				if(cmdSeqs[0]==='GENERAL-SUPPORT'){
					//nothing to do, let wa operator handle the chat without annoying with auto responder
				}
				
				if(cmdSeqs[0]==='IT-SUPPORT'){
					//current date time
					cmdSeq = cmdSeqs[0]+ ' '+ dateval;
					//update timestamp for this thread, if it support already sent closing notif and no reply from user anymore, bot will close this chat thread
					sqlupdate = `update chatthread set cmd_seq='${cmdSeq}' where id=${chatrec.id}`;
					await con.query(sqlupdate);
					
				}
				
				if(cmdSeqs[0]==='SAY-HELLO'){
					if(cmdStage==1){
						if(msgBody==='BYE'){
							//concat(cmd_seq,'${chatrec.cmd_seq}')
							sqlupdate = `update chatthread set status=9, cmd_seq='${cmdSeqs[0]}' where id=${chatrec.id}`;
							await con.query(sqlupdate);
							msg.reply(`Terimakasih telah berkomunikasi dengan ${botName}`);
						} else {
							botResp = await generateText(msgBody);
							await msg.reply(botResp);
							msg.reply(`Untuk menutup percakapan dengan ${botName}, silahkan ketik BYE`);
						}
					}
					if(cmdStage==2){
					}
				}
			} 
		}
	}
	
});




// Endpoint untuk mengirim gambar berserta pesan
app.post('/send-image', async(req, res) => {
    const { phoneNumber, imagePath, message } = req.body;
 
    try {
        const media = await MessageMedia.fromFilePath('image_temp/send_image.png');
        const chat = await client.getChatById(`${phoneNumber}@c.us`);
        await chat.sendMessage(`${message}`, { media });
        res.status(200).json({ success: true, message: 'Gambar berhasil dikirim berserta pesan.' });
    } catch (error) {
        console.error('Gagal mengirim gambar:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengirim gambar.' });
    }
});



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

