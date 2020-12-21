/// <reference path="../../ext/event-emitter.ts"/>
/*
interface PromiseConstructor {
	new(executor: (resolve: (value?: void|PromiseLike<void>) => void, reject: (reason?:any) => void) => void) : Promise<void>
}
*/
const enum Time {
	Hours = 3600000,
	Minutes = 60000,
	Seconds = 1000,
}

//declare var Promise:PromiseConstructor;
declare var requirejs:any;
declare var define:any;
declare var Vue:any;
declare var LZMA:any;

/* portal.ts - Initial bootstrap of the main interface */
(function(global:typeof globalThis) {

//	const SENTRY_DSN = 'https://8f4deaf7821e48ddaa2e380d5eb01393@sentry.teamworkgroup.com/4';
//	const SENTRY_ENVIRONMENT = 'next';
	
	function doGenericCatch(err:any, transaction:string, context?:any) {
/*		if(!('Sentry' in window)) return;
		if(err instanceof Error) {
			Sentry.withScope((scope:any) => {
				if(context) scope.setExtra('context', context);
				scope.setTransaction(transaction);
				Sentry.captureMessage(err, Sentry.Severity.Error);
			});
		} else {
			const message = (typeof err == 'string' ? err : JSON.stringify(err));
			const stackMark = new Error(message);
			Sentry.withScope((scope:any) => {
				if(context) scope.setExtra('context', context);
				scope.setExtra('errorThrown', err);
				scope.setTransaction(transaction);
				Sentry.captureMessage(stackMark, Sentry.Severity.Error);
			});
		}*/
	}

	function loadScript(url:string) : Promise<void>
	{
		return new Promise((resolve:()=>void, reject:(e:any)=>void) => {
			let script = <HTMLScriptElement>document.createElement('SCRIPT');
			script.setAttribute('type', 'text/javascript');
			script.setAttribute('src', url);
			
			function resetCallbacks()
			{
				script.onload = oldOnload;
				script.onerror = oldOnerror;
				(script as any).onreadystatechange = oldOnreadystatechange;
			}
			
			// way too many different ways that browsers do callbacks...
			var oldOnload = script.onload;
			var oldOnerror = script.onerror;
			var oldOnreadystatechange = (script as any).onreadystatechange;
			
			script.onload = () => {
				resolve();
				resetCallbacks();
			};
			script.onerror = (evt) => {
				reject(evt);
				resetCallbacks();
			};
			(script as any).onreadystatechange = () => {
				if((script as any).readyState == 'loaded' || (script as any).readyState == 'complete')
				{
					resolve();
					resetCallbacks();
				}
			};
			try
			{
				document.body.appendChild(script);
			}
			catch(e)
			{
				reject(e);
				resetCallbacks();
			}
		});
	}

	let HEAD_OBJECT : HTMLHeadElement|null = null;
	function getHead() : HTMLHeadElement|null
	{
		if(!HEAD_OBJECT)
		{
			var headObjs = document.getElementsByTagName('HEAD');
			HEAD_OBJECT = <HTMLHeadElement|null>(headObjs?.length && headObjs[0]);
			if(!HEAD_OBJECT){debugger; return null;}
		}
		return HEAD_OBJECT;
	}

	let STYLES_LOADED : {[key:string]:boolean} = {};
	function loadStyle(url:string)
	{
		if(STYLES_LOADED[url]) return;
		const headObj = getHead();
		if(!headObj){debugger; return;}
		
		let newUrl = url;
		//if(newUrl.indexOf('?') == -1) newUrl += '?' + Date.now();
		const style = <HTMLLinkElement>document.createElement('LINK');
		style.setAttribute('rel', 'stylesheet');
		style.setAttribute('type', 'text/css');
		style.setAttribute('href', newUrl);
		headObj.appendChild(style);
		STYLES_LOADED[url] = true;
	}

	function startupRequireJs() {
		define('@globals', [], {}); // dummy module for storing shared values
		define('vue', [], () => { return {default:(<any>global).Vue}; }); // ignore, Vue is a global

		// define dummy type definitions that are apparently being requested by the main script
		define('js/types/event-emitter', [], () => { return {EventEmitter:EventEmitter}; });
		define('js/types/lzma', [], () => { return {LZMA:LZMA}; });

		requirejs.config({});
	}
/*
	// adapted from Sentry's error logging
	function logVueWarning(msg: string, vm: any, trace: string): void {

		//const COMPONENT_NAME_REGEXP = /(?:^|[-_/])(\w)/g;
		const ROOT_COMPONENT_NAME = 'root';
		const ANONYMOUS_COMPONENT_NAME = 'anonymous component';

		function getComponentName(vm: any): string {
			// Such level of granularity is most likely not necessary, but better safe than sorry. — Kamil
			if (!vm) {
				return ANONYMOUS_COMPONENT_NAME;
			}

			if (vm.$root === vm) {
				return ROOT_COMPONENT_NAME;
			}

			if (!vm.$options) {
				return ANONYMOUS_COMPONENT_NAME;
			}

			if (vm.$options.name) {
				return vm.$options.name;
			}

			if ((<any>vm.$options)._componentTag) {
				return (<any>vm.$options)._componentTag;
			}

			return ANONYMOUS_COMPONENT_NAME;
		}
		
		const metadata: any = {};

		if (vm) {
			try {
				metadata.componentName = getComponentName(vm);
				metadata.propsData = (<any>vm).$options.propsData;
			} catch (_oO) {
				console.log('Unable to extract metadata from Vue component.');
			}
		}

		const err = new Error(msg);

		Sentry.withScope((scope:any) => {
			scope.setContext('vue', metadata);
			Sentry.captureMessage(err, Sentry.Severity.Warning);
		});

		// eslint-disable-next-line no-console
		console.error("[Vue warn]: " + msg + trace);
	}
*/
	function beginLoad() {
        const messageText = document.getElementById('initialProgressMsg');
		if(messageText) messageText.textContent = 'Please wait...';

		function loadTimeout() {
			if(messageText) {
				messageText.textContent = 'Having trouble loading the page, please refresh';
			}
		}
		
		const loadTimer = window.setTimeout(loadTimeout, 30000);
		loadStyle('lib/main.css');
		loadScript('lib/main.js')
			.then(() => {
				const oldDefine = define;
				var pendingComponents : string[]|null = null;

				define = function(this:any, name:string) {
					var ret = oldDefine.apply(this, arguments);
					if(name.match(/^vue\//)) {
						if(pendingComponents) {
							pendingComponents.push(name);
						} else {
							pendingComponents = [name];
							global.setTimeout(declareVueComponents, 0);
						}
					}
					return ret;
				}

				function declareVueComponents() {
					if(!pendingComponents) { debugger; return; } // shouldn't happen
					let thisPass = pendingComponents;
					pendingComponents = null;

					requirejs(thisPass, function() {
						let len = thisPass.length;
						for(let idx=0; idx < len; idx++) {
							let componentMatch = thisPass[idx].match(/^vue\/(.+)$/);
							if(componentMatch) {
								Vue.component(componentMatch[1], arguments[idx].default);
							}
						}
					});
				}

				return loadScript('lib/vue.js');
			})
			.then(() => {
				// initialize RequireJS and transfer control to the main script area
				startupRequireJs();
				requirejs(
					['@globals','js/main/init'],
					($Globals:any, init:any) =>
				{
/*
					if('Sentry' in global) {
						Sentry.init({
							dsn: SENTRY_DSN,
							environment: SENTRY_ENVIRONMENT,
							integrations: [new Sentry.Integrations.Vue({
								Vue,
								attachProps: true,
								logErrors: true,
							})]
						});
						Vue.config.warnHandler = logVueWarning;
					}
*/
					window.clearTimeout(loadTimer);
					if(messageText) {
						messageText.textContent='';
					}
					init.init();
				});
			})
			.catch((reason:any) => {
				doGenericCatch(reason, 'shell.shell.beginLoad.waitForMain');
			});
    }
/*
	if('Sentry' in global) {
		Sentry.init({
			dsn: SENTRY_DSN,
			environment: SENTRY_ENVIRONMENT
		});
	}
*/
	global.onload = beginLoad;
})(this);
