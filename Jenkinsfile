node('docker') {
   stage 'Checkout'
   checkout scm

   stage 'Build'
   // Run the maven build
   sh "docker:build"
}
