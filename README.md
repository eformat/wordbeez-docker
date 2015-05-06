# wordbeez-docker
-----------------

<p>A Tomcat 8, HTML5, CSS3 web game for testing dockerized paas deployment</p>

<p>Open source licences contained in wbee-1.0/README.txt</p>

<h3>Installation using OpenShift v3</h3>

<p>The following instructions demonstrate the setup of a jenkins container to build and run the application</p>

<h4>Prerequisites</h4>

<p>You need to have a working OpenShift V3 PaaS</p>

<h4>Install Steps</h4>

<p>Add an OpenShift user using htpasswd. Note you could be using other authentication methods.</p>

<pre>
useradd mike
htpasswd -b /etc/openshift-passwd mike password
</pre>

<p>As the admin user on OpenShift, add a new project</p> 

<pre>
osadm new-project wbeez --display-name="Docker Tomcat Wbeez"
--description='docker html5 word game application'
--admin=mike
</pre>

<p>Login as our user and switch to our newly created project</p>

<pre>
su - mike
osc login -u mike --certificate-authority=/var/lib/openshift/openshift.local.certificates/ca/cert.crt --server=https://ose3-master.example.com:8443
osc project wbeez
</pre>

<p>Create the application using the Dockerfile in this git repo and start the build</p>

<pre>
osc new-app https://github.com/eformat/wordbeez-docker -l name=wbeez
osc start-build wordbeez-docker
</pre>

<p>As the root user, check build logs</p>

<pre>
osc build-logs wordbeez-docker-1 -n wbeez
</pre>

<p>Add a route as user mike</p>

<pre>
su - mike
cd
git clone https://github.com/eformat/ose3-beta-configs
cd ~/ose3-beta-configs
osc create -f wbeez-route.json
</pre>

<p>You can check its working by browsing here</p>

<pre>
http://wbeez.cloudapps.example.com/wbee/
</pre>

<p>Create the jenkins container in same project</p>

<pre>
osc create -f jenkins-config.json
</pre>

<p>Now create a route for jenkins. This is in the same ose3-beta-configs folder</p>

<pre>
osc create -f jenkins-route.json
</pre>

<p>Once its provisioned, you should be able to see jenkins here</p>

<pre>
http://jenkins.cloudapps.example.com/
</pre>

<p>Create a new jenkins job using the REST api and jenkins job definition</p>

<pre>
export JENKINS_ENDPOINT=jenkins.cloudapps.example.com
cat job-wbee.xml | curl -X POST -H "Content-Type: application/xml" -H "Expect: " --data-binary @- http://$JENKINS_ENDPOINT/createItem?name=wbeez
</pre>

<p>Kick off the build from jenkins. This will build and deploy the application</p>

<h4>Other useful commands</h4>

<p>Restart wbeez - the replication controller (rc) will restart the wbeez pod</p>
 
<pre>
osc delete pod `osc get pod | grep wbeez | awk '{print $1}'`
</pre>

<p>You can of course kick off a build with the web hook as well. note
that the password in the URL will change for your deployment</p>

<pre>
curl -i -H "Accept: application/json" \
-H "X-HTTP-Method-Override: PUT" -X POST -k \
https://ose3-master.example.com:8443/osapi/v1beta1/buildConfigHooks/wbeez/UV96hioSyeKEM1_u2Plp/generic?namespace=wbeez
</pre>

<h3>TODO</h3>

1. Webhooks and Github hooks should be easy to integrate such that
code checkins to a git (or svn) repo trigger a build

2. Externalise jenkins. This requires a change to jenkins job configuration such
that it can work cross project and cross user - should be doable using config
parameters