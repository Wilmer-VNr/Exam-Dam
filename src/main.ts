import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular';
import { AppComponent } from './app/app.component';
import { appRouting } from './app/app.routes';
import { provideHttpClient } from '@angular/common/http';

// 👇 Agrega estos imports para Firebase y Firestore
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from './environments/environment'; // asegúrate que el archivo exista
import { defineCustomElements } from '@ionic/pwa-elements/loader';
defineCustomElements(window);
bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(IonicModule.forRoot()),
    appRouting,
    provideHttpClient(),

    // ✅ Inicializa Firebase App
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),

    // ✅ Proveedor para Firestore
    provideFirestore(() => getFirestore()),
  ],
});
