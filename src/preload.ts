export function preLoadCheck(){
    // Server-first runtime: web-only preload branches are removed.
    localStorage.setItem('mainpage', 'visited');
    
    return true;
}
