import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import useAuthStore from '../state/authStore';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import { validateEmail, validatePassword } from '../utils/validationHelpers';
import { fontStyles } from '../utils/fonts';
import { toastManager } from '../utils/toastManager';
import { configureGoogleSignIn, signInWithGoogle } from '../services/GoogleSignInService';

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

function SignInScreen() {
  const navigation = useNavigation<SignInScreenNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const { signIn, isLoading, error } = useAuthStore();

  // Animated values for aura movement
  const blueAuraY = useRef(new Animated.Value(0)).current;
  const purpleAuraY = useRef(new Animated.Value(0)).current;

  // Generate particles with random positions and animations
  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      opacity: new Animated.Value(Math.random() * 0.5 + 0.3),
      translateY: new Animated.Value(0),
      delay: Math.random() * 3000,
      duration: Math.random() * 4000 + 3000,
      isBlue: Math.random() > 0.5,
    })),
  ).current;

  useEffect(() => {
    // Configure Google Sign-In on mount
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    // Blue aura animation (from top)
    Animated.loop(
      Animated.sequence([
        Animated.timing(blueAuraY, {
          toValue: 30,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(blueAuraY, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Purple aura animation (from bottom)
    Animated.loop(
      Animated.sequence([
        Animated.timing(purpleAuraY, {
          toValue: -30,
          duration: 3500,
          useNativeDriver: true,
        }),
        Animated.timing(purpleAuraY, {
          toValue: 0,
          duration: 3500,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Animate particles
    particles.forEach((particle) => {
      setTimeout(() => {
        // Float animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle.translateY, {
              toValue: -50,
              duration: particle.duration,
              useNativeDriver: true,
            }),
            Animated.timing(particle.translateY, {
              toValue: 0,
              duration: particle.duration,
              useNativeDriver: true,
            }),
          ]),
        ).start();

        // Opacity animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle.opacity, {
              toValue: 0.1,
              duration: particle.duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(particle.opacity, {
              toValue: 0.8,
              duration: particle.duration / 2,
              useNativeDriver: true,
            }),
          ]),
        ).start();
      }, particle.delay);
    });
  }, [blueAuraY, purpleAuraY, particles]);

  const validateEmailInput = (email: string) => {
    const result = validateEmail(email);
    setEmailError(result.error || '');
    return result.isValid;
  };

  const validatePasswordInput = (password: string) => {
    const result = validatePassword(password);
    setPasswordError(result.error || '');
    return result.isValid;
  };

  const handleGoogleButtonPress = async () => {
    try {
      setIsGoogleLoading(true);
      console.log('🔵 handleGoogleButtonPress: Starting Google sign-in');

      const result = await signInWithGoogle();

      if (!result.success) {
        throw new Error(result.error || 'Google sign-in failed');
      }

      console.log('✅ Google sign-in completed successfully');
      toastManager.success('Successfully signed in with Google!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Google sign-in failed';

      // Don't show error or log if user cancelled (this is normal behavior)
      if (errorMessage === 'Sign-in was cancelled') {
        console.log('ℹ️ Google sign-in was cancelled by user');
        return;
      }

      // Only log actual errors
      console.error('❌ Error in handleGoogleButtonPress:', error);
      toastManager.error(errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      console.log('🔵 handleSignIn: Starting sign-in process');
      console.log('🔵 Email:', email);
      console.log('🔵 signIn function type:', typeof signIn);
      console.log('🔵 signIn function:', signIn);

      if (typeof signIn !== 'function') {
        console.log('❌ signIn is not a function!');
        toastManager.error('Authentication system error. Please refresh the app.');
        throw new Error('Authentication service is not properly initialized');
      }

      // Validate email
      const isEmailValid = validateEmailInput(email);
      console.log('🔵 Email valid:', isEmailValid);
      if (!isEmailValid) {
        toastManager.error('Please enter a valid email address');
        return;
      }

      // Validate password
      const isPasswordValid = validatePasswordInput(password);
      console.log('🔵 Password valid:', isPasswordValid);
      if (!isPasswordValid) {
        toastManager.error('Please enter a valid password');
        return;
      }

      // Sanitize email only (trim and lowercase) - passwords should NEVER be sanitized
      // as they can contain any characters and sanitization would break authentication
      const sanitizedEmail = email.trim().toLowerCase();
      // Password should be sent as-is without any sanitization
      const rawPassword = password;

      console.log('🔵 About to call signIn with sanitized email:', sanitizedEmail);
      await signIn(sanitizedEmail, rawPassword);
      console.log('✅ signIn completed successfully');
    } catch (error: unknown) {
      console.log('❌ Error in handleSignIn:', error);

      // Handle Firebase-specific errors with user-friendly messages
      const firebaseError = error as { code?: string; message?: string };
      let userMessage = 'Sign in failed. Please try again.';

      if (firebaseError.code === 'auth/invalid-credential') {
        userMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (firebaseError.code === 'auth/user-not-found') {
        userMessage = 'No account found with this email address.';
      } else if (firebaseError.code === 'auth/wrong-password') {
        userMessage = 'Incorrect password. Please try again.';
      } else if (firebaseError.code === 'auth/invalid-email') {
        userMessage = 'Invalid email address format.';
      } else if (firebaseError.code === 'auth/user-disabled') {
        userMessage = 'This account has been disabled. Please contact support.';
      } else if (firebaseError.code === 'auth/too-many-requests') {
        userMessage = 'Too many failed attempts. Please try again later.';
      } else if (firebaseError.code === 'auth/network-request-failed') {
        userMessage = 'Network error. Please check your internet connection.';
      } else if (error instanceof Error && error.message) {
        userMessage = error.message;
      }

      toastManager.error(userMessage);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toastManager.warning('Please enter your email address first');
      return;
    }

    // Validate and sanitize email (trim and lowercase only)
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      toastManager.warning(emailValidation.error || 'Please enter a valid email address');
      return;
    }

    const sanitizedEmail = email.trim().toLowerCase();

    try {
      await sendPasswordResetEmail(auth, sanitizedEmail);
      toastManager.success('Password reset email sent! Check your inbox.');
    } catch (error: unknown) {
      // Handle Firebase-specific errors with user-friendly messages
      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code === 'auth/user-not-found') {
        toastManager.error('No account found with this email address');
      } else if (firebaseError.code === 'auth/invalid-email') {
        toastManager.error('Invalid email address');
      } else if (firebaseError.code === 'auth/too-many-requests') {
        toastManager.error('Too many attempts. Please try again later.');
      } else {
        toastManager.error('Failed to send reset email. Please try again.');
      }
    }
  };

  const handleSignUpNavigation = () => {
    navigation.navigate('SignUp');
  };

  return (
    <View style={styles.container}>
      {/* Black background */}
      <View style={styles.blackBackground} />

      {/* Animated blue aura from top - smokey and rounded */}
      <Animated.View
        style={[
          styles.blueAura,
          {
            transform: [{ translateY: blueAuraY }],
          },
        ]}
      >
        <View style={styles.smokeContainer}>
          <LinearGradient
            colors={[
              'rgba(59, 130, 246, 0.5)',
              'rgba(59, 130, 246, 0.35)',
              'rgba(59, 130, 246, 0.2)',
              'rgba(59, 130, 246, 0.1)',
              'transparent',
            ]}
            style={[styles.auraGradient, styles.smokeBlob]}
          />
          <LinearGradient
            colors={[
              'rgba(96, 165, 250, 0.4)',
              'rgba(96, 165, 250, 0.25)',
              'rgba(96, 165, 250, 0.15)',
              'transparent',
            ]}
            style={[styles.auraGradient, styles.smokeBlob, styles.smokeBlobOffset]}
          />
        </View>
      </Animated.View>

      {/* Animated purple aura from bottom - smokey and rounded */}
      <Animated.View
        style={[
          styles.purpleAura,
          {
            transform: [{ translateY: purpleAuraY }],
          },
        ]}
      >
        <View style={styles.smokeContainer}>
          <LinearGradient
            colors={[
              'transparent',
              'rgba(168, 85, 247, 0.1)',
              'rgba(168, 85, 247, 0.2)',
              'rgba(168, 85, 247, 0.35)',
              'rgba(168, 85, 247, 0.5)',
            ]}
            style={[styles.auraGradient, styles.smokeBlob]}
          />
          <LinearGradient
            colors={[
              'transparent',
              'rgba(192, 132, 252, 0.15)',
              'rgba(192, 132, 252, 0.25)',
              'rgba(192, 132, 252, 0.4)',
            ]}
            style={[styles.auraGradient, styles.smokeBlob, styles.smokeBlobOffset]}
          />
        </View>
      </Animated.View>

      {/* Floating particles */}
      <View style={styles.particlesContainer}>
        {particles.map((particle) => (
          <Animated.View
            key={particle.id}
            style={[
              styles.particle,
              {
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.isBlue
                  ? 'rgba(59, 130, 246, 0.8)'
                  : 'rgba(168, 85, 247, 0.8)',
                opacity: particle.opacity,
                transform: [{ translateY: particle.translateY }],
              },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.contentContainer}>
            {/* Compact Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Your AI-powered business awaits</Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}


            {/* Compact Form */}
            <View style={styles.form}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.textInput, emailError && styles.inputError]}
                  placeholder='Email'
                  placeholderTextColor='rgba(255, 255, 255, 0.5)'
                  value={email}
                  onChangeText={text => {
                    setEmail(text);
                    if (emailError) validateEmailInput(text);
                  }}
                  onBlur={() => validateEmailInput(email)}
                  keyboardType='email-address'
                  autoCapitalize='none'
                  autoComplete='email'
                  editable={!isLoading}
                />
                {emailError ? <Text style={styles.validationError}>{emailError}</Text> : null}
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.textInput, styles.passwordInput, passwordError && styles.inputError]}
                    placeholder='Password'
                    placeholderTextColor='rgba(255, 255, 255, 0.5)'
                    value={password}
                    onChangeText={text => {
                      setPassword(text);
                      if (passwordError) validatePasswordInput(text);
                    }}
                    onBlur={() => validatePasswordInput(password)}
                    secureTextEntry={!showPassword}
                    autoCapitalize='none'
                    autoComplete='password'
                    editable={!isLoading}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color='rgba(255, 255, 255, 0.8)'
                    />
                  </Pressable>
                </View>
                {passwordError ? <Text style={styles.validationError}>{passwordError}</Text> : null}
              </View>

              {/* Forgot Password */}
              <View style={styles.linkContainer}>
                <Pressable onPress={handleForgotPassword} disabled={isLoading}>
                  <Text style={styles.forgotPassword}>Forgot Password?</Text>
                </Pressable>
              </View>

              {/* Sign In Button */}
              <Pressable
                onPress={handleSignIn}
                style={styles.signInButton}
                disabled={isLoading || isGoogleLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#1F2937" />
                ) : (
                  <Text style={styles.signInButtonText}>Sign In</Text>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>

              {/* Google Sign-In Button */}
              <Pressable
                onPress={handleGoogleButtonPress}
                style={styles.googleButton}
                disabled={isLoading || isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color="#1F2937" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#1F2937" />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              {/* Sign Up Link */}
              <View style={styles.signUpContainer}>
                <Text style={styles.signUpText}>New to our platform? </Text>
                <Pressable onPress={handleSignUpNavigation} disabled={isLoading}>
                  <Text style={styles.signUpButtonText}>Create Account</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  blackBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  blueAura: {
    position: 'absolute',
    top: -250,
    left: -50,
    right: -50,
    height: 600,
  },
  purpleAura: {
    position: 'absolute',
    bottom: -250,
    left: -50,
    right: -50,
    height: 600,
  },
  smokeContainer: {
    flex: 1,
    position: 'relative',
  },
  auraGradient: {
    flex: 1,
    width: '100%',
  },
  smokeBlob: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
    opacity: 0.8,
  },
  smokeBlobOffset: {
    transform: [{ scale: 0.85 }],
    opacity: 0.6,
  },
  particlesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    borderRadius: 9999,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  keyboardAvoid: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    ...fontStyles.titleLarge,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    letterSpacing: 1,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  errorContainer: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    textAlign: 'center',
    fontWeight: '500',
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 6,
  },
  inputWrapper: {
    position: 'relative',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  passwordInput: {
    paddingRight: 50,
  },
  inputError: {
    borderColor: '#F87171',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
  },
  eyeIcon: {
    position: 'absolute',
    right: 18,
    top: 16,
    padding: 2,
  },
  validationError: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  linkContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  forgotPassword: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  signInButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingVertical: 18,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  signInButtonText: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginHorizontal: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  googleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  signUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  signUpText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    textDecorationLine: 'underline',
    letterSpacing: 0.3,
  },
});

export default SignInScreen;
