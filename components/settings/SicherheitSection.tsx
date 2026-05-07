import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Clipboard, KeyboardAvoidingView, Modal, Platform,
  Pressable, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useColors } from '../theme';
import { useT } from '../../i18n';
import { useBiometric } from '../../contexts/BiometricContext';
import { setEncryptionEnabled, resetEncryptionKey, exportEncKey, importEncKey } from '../../utils/crypto';
import { setFallbackPassword, checkFallbackPassword, hasFallbackPassword, generateRecoveryCode, setRecoveryCode, hasRecoveryCode } from '../../utils/auth';

interface Props {
  encEnabled: boolean;
  onEncEnabledChange: (v: boolean) => void;
}

export function SicherheitSection({ encEnabled, onEncEnabledChange }: Props) {
  const c = useColors();
  const t = useT();
  const { enabled: bioEnabled, available: bioAvailable, setEnabled: setBioEnabled } = useBiometric();

  const [recoveryCode, setRecoveryCodeState] = useState<string | null>(null);
  const [hasRecovery, setHasRecovery] = useState(false);

  const [pwModal, setPwModal] = useState<'set' | 'change' | 'reset' | null>(null);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');

  const [encKeyModal, setEncKeyModal] = useState<'export' | 'import' | null>(null);
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [importKeyText, setImportKeyText] = useState('');
  const [importKeyError, setImportKeyError] = useState('');

  const styles = useMemo(() => StyleSheet.create({
    subLabel: { fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
    warnText: { fontSize: 12, color: c.muted },
    accentText: { color: c.accent, fontSize: 15 },
    saveButton: { borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
    saveText: { color: c.accent, fontSize: 16 },
    resetBtn: { borderWidth: 1, borderColor: c.danger, borderRadius: 10, padding: 12, alignItems: 'center' },
    resetBtnText: { color: c.danger, fontSize: 14 },
    switchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.bg, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 14,
    },
    switchLabel: { fontSize: 16, color: c.text },
    placeholder: { backgroundColor: c.bg, borderRadius: 8, padding: 14, alignItems: 'center' },
    recoveryCode: {
      fontSize: 28, fontWeight: '700', color: c.accent, textAlign: 'center',
      letterSpacing: 4, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier', paddingVertical: 8,
    },
    recoveryHint: { fontSize: 12, color: c.muted, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 12 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    modalInput: { backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.text },
    modalError: { fontSize: 13, color: c.danger },
    modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    modalCancel: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalCancelText: { color: c.muted, fontSize: 15 },
  }), [c]);

  useEffect(() => {
    hasRecoveryCode().then(setHasRecovery);
  }, []);

  const handleBioToggle = async (v: boolean) => {
    if (v) {
      const hasPw = await hasFallbackPassword();
      if (!hasPw) { setPwModal('set'); return; }
    }
    await setBioEnabled(v);
  };

  const closePwModal = () => {
    setPwModal(null);
    setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError('');
  };

  const handleSavePassword = async () => {
    if (pwNew.length < 4) { setPwError(t.settings.pwErrorMinLength); return; }
    if (pwNew !== pwConfirm) { setPwError(t.settings.pwErrorMismatch); return; }
    if (pwModal === 'change') {
      const ok = await checkFallbackPassword(pwCurrent);
      if (!ok) { setPwError(t.settings.pwErrorWrong); return; }
    }
    await setFallbackPassword(pwNew);
    if (pwModal === 'set') await setBioEnabled(true);
    closePwModal();
    Alert.alert(t.settings.pwSaved);
  };

  const handleBioReset = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t.settings.btnResetWithBiometric,
      disableDeviceFallback: true,
    });
    if (result.success) { setPwModal('reset'); }
    else { Alert.alert(t.settings.bioResetAbortTitle, t.settings.bioResetAbortMsg); }
  };

  const handleGenerateRecovery = async () => {
    const code = await generateRecoveryCode();
    await setRecoveryCode(code);
    setHasRecovery(true);
    setRecoveryCodeState(code);
  };

  const handleShowExportKey = async () => {
    const key = await exportEncKey();
    setExportedKey(key);
    setEncKeyModal('export');
  };

  const handleCopyKey = () => {
    if (exportedKey) {
      Clipboard.setString(exportedKey);
      Alert.alert(t.settings.logCopied);
    }
  };

  const handleImportKey = async () => {
    setImportKeyError('');
    try {
      await importEncKey(importKeyText);
      onEncEnabledChange(true);
      setEncKeyModal(null);
      setImportKeyText('');
      Alert.alert(t.settings.importKeySuccess);
    } catch {
      setImportKeyError(t.settings.importKeyError);
    }
  };

  return (
    <>
      <Text style={styles.subLabel}>{t.settings.subBiometric}</Text>
      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, !bioAvailable && { color: c.muted }]}>{t.settings.biometricActive}</Text>
        <Switch value={bioEnabled} onValueChange={handleBioToggle} disabled={!bioAvailable} trackColor={{ false: c.border, true: c.accent }} thumbColor="#fff" />
      </View>
      {!bioAvailable && <Text style={styles.warnText}>{t.settings.biometricUnavailable}</Text>}
      {bioEnabled && (
        <>
          <Pressable style={styles.saveButton} onPress={() => setPwModal('change')}>
            <Text style={styles.saveText}>{t.settings.btnChangePassword}</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={handleBioReset}>
            <Text style={styles.saveText}>{t.settings.btnResetWithBiometric}</Text>
          </Pressable>
          <Pressable
            style={styles.saveButton}
            onPress={() => Alert.alert(
              hasRecovery ? t.settings.recoveryReplaceTitle : t.settings.recoveryGenerateTitle,
              hasRecovery ? t.settings.recoveryReplaceMsg : t.settings.recoveryGenerateMsg,
              [
                { text: t.common.cancel, style: 'cancel' },
                { text: hasRecovery ? t.settings.recoveryReplaceBtn : t.settings.recoveryGenerateBtn, onPress: handleGenerateRecovery },
              ],
            )}
          >
            <Text style={styles.saveText}>{hasRecovery ? t.settings.btnReplaceRecovery : t.settings.btnGenerateRecovery}</Text>
          </Pressable>
          {recoveryCode && (
            <View style={[styles.placeholder, { gap: 6 }]}>
              <Text style={styles.recoveryCode}>{recoveryCode}</Text>
              <Text style={styles.recoveryHint}>{t.settings.recoveryHint}</Text>
              <Pressable onPress={() => setRecoveryCodeState(null)}>
                <Text style={[styles.accentText, { textAlign: 'center', marginTop: 4 }]}>{t.settings.btnRecoveryDismiss}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      <Text style={[styles.subLabel, { marginTop: 10 }]}>{t.settings.subEncryption}</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t.settings.encryptionLabel}</Text>
        <Switch
          value={encEnabled}
          onValueChange={async (v) => { await setEncryptionEnabled(v); onEncEnabledChange(v); }}
          trackColor={{ false: c.border, true: c.accent }}
          thumbColor="#fff"
        />
      </View>
      <Text style={styles.warnText}>{t.settings.encryptionWarn}</Text>
      {encEnabled && (
        <>
          <Pressable style={styles.saveButton} onPress={handleShowExportKey}>
            <Text style={styles.saveText}>{t.settings.btnExportKey}</Text>
          </Pressable>
          <Pressable
            style={styles.resetBtn}
            onPress={() => Alert.alert(
              t.settings.keyResetTitle,
              t.settings.keyResetMsg,
              [
                { text: t.common.cancel, style: 'cancel' },
                { text: t.settings.keyResetBtn, style: 'destructive', onPress: () => resetEncryptionKey() },
              ],
            )}
          >
            <Text style={styles.resetBtnText}>{t.settings.btnResetKey}</Text>
          </Pressable>
        </>
      )}
      <Pressable style={styles.saveButton} onPress={() => { setImportKeyText(''); setImportKeyError(''); setEncKeyModal('import'); }}>
        <Text style={styles.saveText}>{t.settings.btnImportKey}</Text>
      </Pressable>

      {/* Passwort-Modal */}
      <Modal visible={pwModal !== null} transparent animationType="fade" onRequestClose={closePwModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {pwModal === 'set' ? t.settings.pwSetTitle : pwModal === 'reset' ? t.settings.pwResetTitle : t.settings.pwChangeTitle}
            </Text>
            {pwModal === 'change' && (
              <TextInput style={styles.modalInput} value={pwCurrent} onChangeText={(v) => { setPwCurrent(v); setPwError(''); }} placeholder={t.settings.pwCurrentPlaceholder} placeholderTextColor={c.muted} secureTextEntry />
            )}
            <TextInput style={styles.modalInput} value={pwNew} onChangeText={(v) => { setPwNew(v); setPwError(''); }} placeholder={t.settings.pwNewPlaceholder} placeholderTextColor={c.muted} secureTextEntry />
            <TextInput style={styles.modalInput} value={pwConfirm} onChangeText={(v) => { setPwConfirm(v); setPwError(''); }} placeholder={t.settings.pwConfirmPlaceholder} placeholderTextColor={c.muted} secureTextEntry onSubmitEditing={handleSavePassword} returnKeyType="done" />
            {!!pwError && <Text style={styles.modalError}>{pwError}</Text>}
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalCancel} onPress={closePwModal}><Text style={styles.modalCancelText}>{t.common.cancel}</Text></Pressable>
              <Pressable style={styles.modalBtn} onPress={handleSavePassword}><Text style={styles.modalBtnText}>{t.common.save}</Text></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Schlüssel exportieren */}
      <Modal visible={encKeyModal === 'export'} transparent animationType="fade" onRequestClose={() => setEncKeyModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEncKeyModal(null)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t.settings.exportKeyTitle}</Text>
            <Text style={styles.warnText}>{t.settings.exportKeyHint}</Text>
            <Pressable style={[styles.modalInput, { justifyContent: 'center' }]} onPress={handleCopyKey}>
              <Text style={[styles.recoveryCode, { fontSize: 11, letterSpacing: 1 }]} numberOfLines={3} selectable>
                {exportedKey ?? '–'}
              </Text>
            </Pressable>
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalCancel} onPress={() => setEncKeyModal(null)}>
                <Text style={styles.modalCancelText}>{t.common.ok}</Text>
              </Pressable>
              <Pressable style={styles.modalBtn} onPress={handleCopyKey}>
                <Text style={styles.modalBtnText}>{t.settings.logCopy}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Schlüssel importieren */}
      <Modal visible={encKeyModal === 'import'} transparent animationType="fade" onRequestClose={() => setEncKeyModal(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={{ flex: 1 }} onPress={() => setEncKeyModal(null)} />
          <View style={[styles.modalBox, { marginHorizontal: 24, marginBottom: 24 }]}>
            <Text style={styles.modalTitle}>{t.settings.importKeyTitle}</Text>
            <Text style={styles.warnText}>{t.settings.importKeyHint}</Text>
            <TextInput
              style={styles.modalInput}
              value={importKeyText}
              onChangeText={(v) => { setImportKeyText(v); setImportKeyError(''); }}
              placeholder={t.settings.importKeyPlaceholder}
              placeholderTextColor={c.muted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={2}
            />
            {!!importKeyError && <Text style={styles.modalError}>{importKeyError}</Text>}
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalCancel} onPress={() => setEncKeyModal(null)}>
                <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={styles.modalBtn} onPress={handleImportKey}>
                <Text style={styles.modalBtnText}>{t.settings.btnImportKey}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
