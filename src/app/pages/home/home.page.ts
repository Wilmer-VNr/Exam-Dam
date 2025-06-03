import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { supabase } from 'src/app/supabase.client';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
})
export class HomePage implements OnInit, OnDestroy {
  user: any = null;
  messages: any[] = [];
  newMessage: string = '';
  channel: any;

  latitude: number | null = null;
  longitude: number | null = null;
  linkMaps: string = '';

  profileUrl: string | null = null;

  constructor(private router: Router, private firestore: Firestore) {}

  async ngOnInit() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      this.router.navigate(['/auth']);
      return;
    }

    this.user = user;
    const email = this.user.email;
    this.user.username = email.split('@')[0];

    await this.loadMessages();
    this.listenForNewMessages();
    await this.loadProfileImage(); // <- cargar imagen de perfil
  }

  ngOnDestroy() {
    this.channel?.unsubscribe();
  }

  async loadMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error) {
      this.messages = data || [];
      this.scrollToBottom();
    } else {
      console.error(error);
    }
  }

  listenForNewMessages() {
    this.channel = supabase
      .channel('realtime:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          this.messages.push(payload.new);
          this.scrollToBottom();
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status);
      });
  }

  async sendMessage() {
    if (!this.newMessage.trim()) return;

    const { error } = await supabase.from('messages').insert({
      user_id: this.user.id,
      user_email: this.user.email,
      username: this.user.username,
      content: this.newMessage.trim(),
      image_url: null,
      profile_photo: false,
    });

    if (error) {
      console.error(error);
    } else {
      this.newMessage = '';
    }
  }

  async uploadFile(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;

    const filePath = `${this.user.email}/${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file);

    if (error) {
      console.error('Error al subir archivo:', error.message);
    } else {
      const { data: urlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      await supabase.from('messages').insert({
        user_id: this.user.id,
        user_email: this.user.email,
        username: this.user.username,
        content: '',
        image_url: publicUrl,
        profile_photo: false,
      });
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      const content = document.querySelector('ion-content');
      (content as any)?.scrollToBottom(300);
    }, 100);
  }

  async logout() {
    await supabase.auth.signOut();
    this.router.navigate(['/auth']);
  }

  // UBICACIÓN
  getCurrentLocation() {
    if (!navigator.geolocation) {
      console.error('Geolocalización no está soportada en este navegador.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        this.linkMaps = `https://www.google.com/maps?q=${this.latitude},${this.longitude}`;
        console.log('Ubicación obtenida:', this.linkMaps);

        const coordenadasTexto = `📍 Mi ubicación\nLat: ${this.latitude}, Lng: ${this.longitude}`;

        const { error } = await supabase.from('messages').insert({
          user_id: this.user.id,
          user_email: this.user.email,
          username: this.user.username,
          content: coordenadasTexto,
          image_url: null,
          profile_photo: false,
        });

        if (error) {
          console.error('Error al enviar ubicación:', error.message);
        }
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  }

  openGoogleMaps() {
    if (this.linkMaps) {
      window.open(this.linkMaps, '_blank');
    }
  }

  async guardarEnFirebase() {
    try {
      const ubicacionesRef = collection(this.firestore, 'ubicacion');
      await addDoc(ubicacionesRef, {
        link: this.linkMaps,
        timestamp: new Date(),
      });

      alert('Ubicación guardada con éxito en Firebase.');
    } catch (error) {
      console.error('Error al guardar en Firebase:', error);
      alert('Error al guardar en Firebase');
    }
  }

  async takePhoto() {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (photo.dataUrl) {
        await this.uploadPhoto(photo.dataUrl);
      }
    } catch (error) {
      console.error('Error tomando la foto:', error);
    }
  }

  async uploadPhoto(dataUrl: string) {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const filePath = `${this.user.email}/${Date.now()}.jpeg`;

      const { data, error } = await supabase.storage
        .from('uploads')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        });

      if (error) {
        console.error('Error al subir la foto:', error.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      await supabase.from('messages').insert({
        user_id: this.user.id,
        user_email: this.user.email,
        username: this.user.username,
        content: '',
        image_url: publicUrl,
        profile_photo: false,
      });

      console.log('Foto tomada subida a Supabase. URL pública:', publicUrl);
    } catch (error) {
      console.error('Error al subir la foto:', error);
    }
  }

  async fetchAndSendApiMessage() {
    try {
      const response = await fetch('https://random.dog/woof.json');
      if (!response.ok) {
        throw new Error('Error en la respuesta de la API');
      }
      const data = await response.json();
      const dogImageUrl = data.url;

      const { error } = await supabase.from('messages').insert({
        user_id: this.user.id,
        user_email: this.user.email,
        username: this.user.username,
        content: '',
        image_url: dogImageUrl,

        
      });

      if (error) {
        console.error('Error al enviar mensaje de API:', error);
      } else {
        console.log('Imagen de perro enviada');
      }

      const ubicacionesRef = collection(this.firestore, 'perros_api');
      await addDoc(ubicacionesRef, {
        url: dogImageUrl,
        timestamp: new Date(),
      });

      console.log('URL de imagen obtenida de la API:', dogImageUrl);
    } catch (error) {
      console.error('Error al consultar API:', error);
    }
  }

  //SUBIR FOTO DE PERFIL
async uploadProfileImage(event: any) {
  const file: File = event.target.files[0];
  if (!file) return;

  const filePath = `/${this.user.email}/${Date.now()}_${file.name}`;

  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(filePath, file);

  if (error) {
    console.error('Error al subir imagen de perfil:', error.message);
    return;
  }

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(filePath);

  const publicUrl = urlData.publicUrl;

  // Aquí estamos insertando la URL de la imagen de perfil en el campo 'profile_photo'
  const { error: insertError } = await supabase.from('messages').insert({
    user_id: this.user.id,
    user_email: this.user.email,
    username: this.user.username,
    content: '✅ Tu foto de perfil se subió exitosamente', // Opcional: mensaje de confirmación
    image_url: null, // Guardamos la URL en 'image_url' para otros tipos de imágenes
    profile_photo: publicUrl, // Guardamos la URL de la foto de perfil en 'profile_photo'
  });

  if (insertError) {
    console.error('Error al guardar imagen de perfil en la tabla messages:', insertError.message);
  } else {
    this.profileUrl = publicUrl; // Almacenamos la URL de la imagen de perfil localmente
    console.log('✅ Tu foto de perfil se subió exitosamente');
  }
}

// ✅ CARGAR FOTO DE PERFIL
async loadProfileImage() {
  const { data, error } = await supabase
    .from('messages')  // Accedemos a la tabla 'messages'
    .select('profile_photo')  // Obtenemos la URL de la imagen de perfil desde el campo 'profile_photo'
    .eq('user_id', this.user.id)  // Filtramos por el ID del usuario
    .order('created_at', { ascending: false })  // Ordenamos por la fecha de creación
    .limit(1)  // Solo obtenemos la más reciente
    .single();

  if (error) {
    console.error('Error al cargar imagen de perfil:', error.message);
    this.profileUrl = null;
  } else {
    this.profileUrl = data?.profile_photo || null;
    console.log('✅ Imagen de perfil cargada:', this.profileUrl);
  }
}

}
