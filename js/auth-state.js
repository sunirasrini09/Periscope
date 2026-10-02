/* PERISCOPE authentication bootstrap.
   Always require an explicit login when the host page is opened/reloaded.
   Firebase remains authentication-only; patient data comes from the PERISCOPE API. */
(async function bootstrapAuth(){
  try {
    await firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.NONE);
    // Clear any previously persisted/current browser session so localhost always opens at login.
    await firebaseAuth.signOut();
  } catch (e) {
    console.warn('Auth persistence bootstrap:', e.message);
  }
  firebaseAuth.onAuthStateChanged(async user => {
    if (user) {
      S.u={name:user.displayName||user.email.split('@')[0],role:'Doctor',email:user.email,dept:'',uid:user.uid};
      S.v=S.v||'dash';
      await loadAppData(user);
    } else {
      S.u=null;
      apiLoaded=false;
      P=[];
      S.pid=null;
      S.auth='login';
      S.v='dash';
      render();
    }
  });
})();
