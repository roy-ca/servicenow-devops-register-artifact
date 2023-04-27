const core = require('@actions/core');
const axios = require('axios');


(async function main() {
    let instanceUrl = core.getInput('instance-url', { required: true });
    const toolId = core.getInput('tool-id', { required: true });
    const username = core.getInput('devops-integration-user-name', { required: false });
    const password = core.getInput('devops-integration-user-password', { required: false });
    const secretToken = core.getInput('devops-secret-token', { required: false});
    const jobName = core.getInput('job-name', { required: true });

    let artifacts = core.getInput('artifacts', { required: true });
    
    try {
        artifacts = JSON.parse(artifacts);
    } catch (e) {
        core.setFailed(`Failed parsing artifacts ${e}`);
        return;
    }

    let githubContext = core.getInput('context-github', { required: true });

    try {
        githubContext = JSON.parse(githubContext);
    } catch (e) {
        core.setFailed(`Exception parsing github context ${e}`);
    }

    let payload;
    
    try {
        instanceUrl = instanceUrl.trim();
        if (instanceUrl.endsWith('/'))
            instanceUrl = instanceUrl.slice(0, -1);

        payload = {
            'artifacts': artifacts,
            'pipelineName': `${githubContext.repository}/${githubContext.workflow}`,
            'stageName': jobName,
            'taskExecutionNumber': `${githubContext.run_id}` + '/attempts/' + `${githubContext.run_attempt}`, 
            'branchName': `${githubContext.ref_name}`
        };
        console.log("paylaod to register artifact: " + JSON.stringify(payload));
    } catch (e) {
        core.setFailed(`Exception setting the payload to register artifact ${e}`);
        return;
    }

    let snowResponse;
    let endpoint = '';
    let httpHeaders = {};

    try {
        if(secretToken !== '') {
            try {
                endpoint = `${instanceUrl}/api/sn_devops/v2/devops/artifact/registration?orchestrationToolId=${toolId}`;
                const defaultHeadersForToken = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + `${secretToken}`
                };

                httpHeaders = { headers: defaultHeadersForToken };
                snowResponse = await axios.post(endpoint, JSON.stringify(payload), httpHeaders);
            } catch(err) {
                console.log('Retrying with username and password');
                if (err.response && err.response.status === 401 && username !== '' && password !== '') {
                    try { 
                        endpoint = `${instanceUrl}/api/sn_devops/devops/artifact/registration?orchestrationToolId=${toolId}`;
                        const token = `${username}:${password}`;
                        const encodedTokenForBasicAuth = Buffer.from(token).toString('base64');
                        const defaultHeadersForBasicAuth = {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Authorization': 'Basic ' + `${encodedTokenForBasicAuth}`
                        };

                        httpHeaders = { headers: defaultHeadersForBasicAuth };
                        snowResponse = await axios.post(endpoint, JSON.stringify(payload), httpHeaders);
                    } catch(err) {
                        throw err;
                    }
                }
                else {
                    throw err;
                }
            }
        }
        else if(username !== '' && password !== '') {
            console.log("Came inside only username and password");
            endpoint = `${instanceUrl}/api/sn_devops/devops/artifact/registration?orchestrationToolId=${toolId}`;
            console.log("Endpoint:"+endpoint);
            const token = `${username}:${password}`;
            const encodedTokenForBasicAuth = Buffer.from(token).toString('base64');;
            const defaultHeadersForBasicAuth = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Basic ' + `${encodedTokenForBasicAuth}`
            };

            httpHeaders = { headers: defaultHeadersForBasicAuth };
            snowResponse = await axios.post(endpoint, JSON.stringify(payload), httpHeaders);
            console.log("Headers:"+JSON.stringify(httpHeaders));
        }
        else {
            core.setFailed('Please provide appropriate credentials');
        }
    } catch (e) {
        if (e.message.includes('ECONNREFUSED') || e.message.includes('ENOTFOUND') || e.message.includes('405')) {
            core.setFailed('ServiceNow Instance URL is NOT valid. Please correct the URL and try again.');
        } else if (e.message.includes('401')) {
            core.setFailed('Invalid Credentials. Please correct the credentials and try again.');
        } else {
            core.setFailed('ServiceNow Artifact Versions are NOT created. Please check ServiceNow logs for more details.');
        }
    }
})();
