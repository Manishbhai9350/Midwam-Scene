



class Injection{
    injectString = '';
    constructor(){

    }
    setInjectString(whom = ''){
        this.injectString = whom;
    }
    inject(where='',what=''){
        this.injectString = this.injectString.replace(where,what);
        return this.inject;
    }
    getInjectedString(){
        return this.injectString;
    }
    addToInjectedString(what = ''){
        this.injectString = what + this.injectString;
        return this.inject;
    }
    InjectObject(whom = Object.create(null) , what = Object.create(null)){
        Object.assign(whom,what)
    }
}

export {Injection}