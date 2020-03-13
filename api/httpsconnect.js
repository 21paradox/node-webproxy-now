
const serializeError = require('serialize-error')
const net = require('net')
const nkn = require('nkn-sdk')

const useMultiClient = true
const Client = useMultiClient ? nkn.MultiClient : nkn.Client

module.exports = async (req, res) => {
  const conncfgRaw = Buffer.from(req.headers.conncfg, 'base64')
  const conncfg = JSON.parse(conncfgRaw)
  const uid = req.headers.uid
  const reqAddr = req.headers.addr
  if (!conncfg) {
    res.status(500).send('should provide reqcfg')
    return
  }

  const carrierClient = new Client({
    identifier: uid,
    seed: process.env.SEED,
    responseTimeout: 8000,
    encrypt: false
  })
  const nknClientReady = new Promise((resolve) => {
    carrierClient.onConnect(resolve)
  })

  const target = net.connect(conncfg)
  let connected = false
  let err = null

  target.on('connect', function () {
    connected = true
    carrierClient.send(reqAddr, '')
  })

  carrierClient.onMessage(async ({ src, payload }) => {
    target.write(Buffer.from(payload))
  })

  target.on('data', async (data) => {
    await nknClientReady
    carrierClient.send(reqAddr, data)
  })

  target.on('close', function () {
    if (err) {
      const errstr = JSON.stringify(serializeError(err), null, 4)
      res.status(500).send(errstr)
    } else {
      res.status(200).send('')
    }
    carrierClient.close()
  })

  target.on('error', function (_err) {
    err = _err

    if (!connected) {
      res.status(500).send('err not connected')
    }
  })
}
