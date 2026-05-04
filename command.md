this file will contain all commands to run this repository:

# install the necessary packages
'''
 npm install @meshsdk/core @meshsdk/react @blockfrost/blockfrost-js stream-browserify crypto-browserify buffer process @craco/craco qrcode.react 
 '''

 # install for backend

'''
 npm install express cors dotenv @blockfrost/blockfrost-js qrcode otplib
'''

# go to backend and create

'''

cd backend
create file .env  

'''

# add in the env file
''' 
BLOCKFROST_KEY= // blockfrost api key
NETWORK=preprod
TOTP_SECRET= // totp secret
'''

# on frontend folder:
' npm start '

# if there is an error while starting frontend folder install:

''' 
npm install web-vitals 
npm start
'''

# on backend folder:
' node server.js '