// src/api/authService.ts
import api from './apiConfig';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import env from '../config/environment';

// Interface pour les données de connexion
export interface LoginCredentials {
  username: string;
  password: string;
  platformType: string
}

// Interface pour la réponse d'utilisateur
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  tenantCode?: string;
  tenantName?: string;
}

// Clés de stockage
const USER_DATA_KEY = 'user_data';

// Service d'authentification
const authService = {
  // Connexion utilisateur
  async login(credentials: LoginCredentials): Promise<User> {
    try {
      const response = await api.post('/api/auth/login', credentials);
      
      // Le serveur répond avec un cookie httpOnly, donc nous n'avons pas besoin
      // de gérer le token nous-mêmes, mais nous stockons quand même les informations utilisateur
      const userData = response.data;
      
      // Stocker les données utilisateur dans AsyncStorage
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Déconnexion utilisateur
  async logout(): Promise<void> {
    try {
      // Appeler l'API pour invalider le cookie de session
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
      // Continuer malgré l'erreur pour nettoyer localement
    }
    
    // Nettoyer le stockage local
    await this.cleanLocalStorage();
  },

  // Déconnexion forcée (optimisée)
  async forceLogout(): Promise<void> {
    try {
      // Créer une instance axios indépendante pour la déconnexion
      const logoutClient = axios.create({
        baseURL: env.apiUrl,
        timeout: 5000,
        withCredentials: true,
        headers: {
          'Cache-Control': 'no-cache',
          'X-Force-Logout': 'true' // Header optionnel pour indiquer une déconnexion forcée
        }
      });
      
      // Ajouter un timestamp pour éviter le cache
      const timestamp = new Date().getTime();
      await logoutClient.post(`/api/auth/logout?t=${timestamp}`);
      
      console.log('Déconnexion forcée effectuée avec succès');
    } catch (error) {
      console.error('Erreur lors de la déconnexion forcée:', error);
      // Continuer malgré l'erreur
    }
    
    // Toujours nettoyer le stockage local
    await this.cleanLocalStorage();
  },

  // Nettoyer uniquement le stockage local
  async cleanLocalStorage(): Promise<void> {
    try {
      await AsyncStorage.removeItem(USER_DATA_KEY);
      // Supprimer d'autres données locales si nécessaire
      console.log('Stockage local nettoyé avec succès');
    } catch (error) {
      console.error('Erreur lors du nettoyage du stockage local:', error);
    }
  },

  // Vérifier si l'utilisateur est connecté
  async isAuthenticated(): Promise<boolean> {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA_KEY);
      if (!userData) return false;
      
      // Vérifier la validité de la session auprès du serveur
      await api.get('/api/auth/me');
      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      // En cas d'erreur, on considère que l'utilisateur n'est pas authentifié
      await this.logout();
      return false;
    }
  },

  // Récupérer les données utilisateur
  async getCurrentUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },
};

export default authService;