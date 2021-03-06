const {expect} = require('chai'),
      {defineSupportCode} = require('cucumber'),
      dimConsole = require('dim-console'),
      ExoComMock = require('exocom-mock'),
      fs = require('fs'),
      jsDiff = require('jsdiff-console'),
      lowercaseKeys = require('lowercase-keys'),
      N = require('nitroglycerin'),
      ObservableProcess = require('observable-process')
      portReservation = require('port-reservation'),
      request = require('request'),
      wait = require('wait'),
      yaml = require('js-yaml')

const serviceConfig = yaml.safeLoad(fs.readFileSync('service.yml'), 'utf8')

defineSupportCode(function({Given, When, Then}) {

  Given(/^an ExoCom server$/, function(done) {
    portReservation.getPort(N( (exocomPort) => {
      this.exocomPort = exocomPort
      this.exocom = new ExoComMock()
      this.exocom.listen(this.exocomPort, done)
    }))
  })


  Given(/^an instance of this service$/, function(done) {
    this.process = new ObservableProcess(serviceConfig.startup.command, {
      env: {
        EXOCOM_PORT: this.exocomPort,
        EXOCOM_HOST: 'localhost',
        ROLE: serviceConfig.type,
      },
      stdout: false,
      stderr: false,
    })
    this.process.wait(serviceConfig.startup['online-text'], done)
  })


  Given(/^the service contains the {{modelName}}s:$/, function(table, done) {
    {{modelName}}s = []
    for (record of table.hashes()) {
      {{modelName}}s.push(lowercaseKeys(record))
    }
    this.exocom.send({ service: '{{serviceRole}}',
                       name: '{{modelName}}.create-many',
                       payload: {{modelName}}s })
    this.exocom.onReceive(done)
  })



  When(/^receiving the message "([^"]*)"$/, function(message) {
    this.exocom.send({ service: '{{serviceRole}}',
                       name: message })
  })


  When(/^receiving the message "([^"]*)" with the payload:$/, function(message, payload, done) {
    this.fillIn{{modelName}}Ids(payload, (filledPayload) => {
      this.exocom.send({ service: '{{serviceRole}}',
                         name: message,
                         payload: JSON.parse(filledPayload) })
      done()
    })
  })



  Then(/^the service contains no {{modelName}}s$/, function(done) {
    this.exocom.send({ service: '{{serviceRole}}',
                       name: '{{modelName}}.list' })
    this.exocom.onReceive( () => {
      expect(this.exocom.receivedMessages[0].payload.count).to.equal(0)
      done()
    })
  })


  Then(/^the service now contains the {{modelName}}s:$/, function(table, done) {
    this.exocom.send({ service: '{{serviceRole}}', name: '{{modelName}}.list' })
    this.exocom.onReceive( () => {
      actual{{modelName}}s = this.removeIds(this.exocom.receivedMessages[0].payload)
      expected{{modelName}}s = []
      for (let {{modelName}} of table.hashes()) {
        expected{{modelName}}s.push(lowercaseKeys({{modelName}}))
      }
      jsDiff(actual{{modelName}}s,
             expected{{modelName}}s,
             done)
    })
  })


  Then(/^the service replies with "([^"]*)" and the payload:$/, function(message, payload, done) {
    var expectedPayload = null
    eval(`expectedPayload = ${payload}`)
    this.exocom.onReceive( () => {
      expect(this.exocom.receivedMessages[0].name).to.equal(message)
      actualPayload = this.exocom.receivedMessages[0].payload
      jsDiff(this.removeIds(actualPayload),
             this.removeIds(expectedPayload),
             done)
    })
  })

});
