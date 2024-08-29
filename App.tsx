// Importações necessárias para o React
import FileViewer from 'react-native-file-viewer';
import React, { Component } from 'react';
import { View, Text, FlatList, TouchableHighlight, TouchableOpacity, Linking, StyleSheet, Image, Button, ActivityIndicator } from 'react-native';
import {ProgressBar} from '@react-native-community/progress-bar-android';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { requestManagePermission, checkManagePermission } from 'manage-external-storage';
import { NavigationContainer } from '@react-navigation/native';
import RNFS from 'react-native-fs';

// Cria um navegador de abas superior
const Tab = createMaterialTopTabNavigator();

// Componente principal do aplicativo
class App extends Component {
  constructor() {
    super();
   // Estado inicial do componente
    this.state = {
      versions: [],
      isLoading: false,
      isManagePermitted: false,
      downloading: false,
      downloadProgress: 0,
      downloadComplete: false,
      downloadedFilePath: '',
      downloadErrorMessage: '',
      downloadSuccessMessage: '',
      showDeleteButton: true,
    };
  }
// Método chamado após o componente ser montado
  componentDidMount() {
 // Verifica a permissão de gerenciamento de armazenamento e busca os dados
    checkManagePermission()
      .then((isManagePermitted) => {
        this.setState({ isManagePermitted });
      })
      .catch((error) => {
        console.error('Erro ao verificar a permissão de gerenciamento de armazenamento externo:', error);
      });
    this.fetchData();
  }

// Solicita permissão de gerenciamento de armazenamento
  requestManageStoragePermission = () => {
    requestManagePermission()
      .then((isManagePermitted) => {
        this.setState({ isManagePermitted });
        if (isManagePermitted) {
          console.log('A permissão de gerenciamento de armazenamento externo foi concedida.');
        } else {
          console.log('A permissão de gerenciamento de armazenamento externo não foi concedida.');
        }
      })
      .catch((error) => {
        console.error('Erro ao solicitar a permissão de gerenciamento de armazenamento externo:', error);
      });
  }

// Busca dados do GitHub
  fetchData() {
    this.setState({ isLoading: true });

    const githubUrl = 'https://raw.githubusercontent.com/MrPurple666/minecraft/main/mine.json';

    fetch(githubUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Erro na resposta da solicitação HTTP');
        }
        return response.json();
      })
      .then((data) => {
        const versions = data.versions.map((version) => ({
          ...version,
          versao: version.versao.split('.').map(Number),
        }));
        versions.sort((a, b) => {
          for (let i = 0; i < Math.min(a.versao.length, b.versao.length); i++) {
            if (a.versao[i] !== b.versao[i]) {
              return b.versao[i] - a.versao[i];
            }
          }
          return b.versao.length - a.versao.length;
        });
        this.setState({ versions, isLoading: false });
      })
      .catch((error) => console.error('Erro ao buscar dados do GitHub:', error))
      .finally(() => {
        this.setState({ isLoading: false });
      });
  }

 // Faz o download do APK
downloadApk = (link, nome) => {
  const apkLink = link;
  const nomeArquivo = nome || link.substring(link.lastIndexOf('/') + 1);
  const downloadDest = `${RNFS.ExternalStorageDirectoryPath}/mclauncher/${nomeArquivo}.apk`;

  RNFS.mkdir(`${RNFS.ExternalStorageDirectoryPath}/mclauncher`, {
    NSURLIsExcludedFromBackupKey: true,
  })
    .then(() => {
      this.setState({ downloading: true, downloadProgress: 0 });
      const options = {
        fromUrl: apkLink,
        toFile: downloadDest,
        progress: (res) => {
          const progress = (res.bytesWritten / res.contentLength) * 100;
          this.setState({ downloadProgress: progress });
        },
      };
      return RNFS.downloadFile(options).promise;
    })
    .then((res) => {
      if (res.statusCode === 200) {
        console.log('Download concluído:', downloadDest);
        this.setState({
          downloadComplete: true,
          downloadSuccessMessage: 'Download concluído. Iniciando a instalação...',
          showDeleteButton: true,
          downloadErrorMessage: '',
          downloading: false,
          downloadProgress: 100,
        });
        this.installApk(downloadDest);
      } else {
        console.log('Erro ao baixar o arquivo APK');
        this.setState({
          downloadErrorMessage: 'Erro ao baixar o arquivo APK',
          downloadSuccessMessage: '',
          downloading: false,
        });
      }
    })
    .catch((error) => {
      console.error('Erro ao fazer o download do APK:', error);
      this.setState({
        downloadErrorMessage: 'Erro ao fazer o download do APK',
        downloadSuccessMessage: '',
        downloading: false,
      });
    });
};

// Abre o link ou baixa o APK se não existir
openLink = (link, nome) => {
  const nomeArquivo = nome || link.substring(link.lastIndexOf('/') + 1);
  const filePath = `${RNFS.ExternalStorageDirectoryPath}/mclauncher/${nomeArquivo}.apk`;

  RNFS.exists(filePath)
    .then((exists) => {
      if (exists) {
        console.log(`Arquivo APK encontrado: ${filePath}`);
        this.setState({ downloadedFilePath: filePath });
        this.installApk(filePath);
      } else {
        console.log(`Arquivo APK não encontrado: ${filePath}`);
        this.downloadApk(link, nome);
      }
    })
    .catch((error) => {
      console.error('Erro ao verificar a existência do arquivo APK:', error);
    });
};
// Instalador do apk TODO: download em background
installApk = (filePath) => {
  FileViewer.open(filePath, { showOpenWithDialog: true })
    .then(() => {
      console.log('Arquivo APK aberto com sucesso');
    })
    .catch((error) => {
      console.error('Erro ao abrir o arquivo APK:', error);
      this.setState({
        downloadErrorMessage: 'Erro ao iniciar a instalação. Por favor, instale manualmente.',
      });
      // Caso o FileViewer falhe, tente abrir com Intent
      this.openWithIntent(filePath);
    });
};

openWithIntent = (filePath) => {
  const android = RNFetchBlob.android;
  android.actionViewIntent(filePath, 'application/vnd.android.package-archive')
    .then(() => {
      console.log('Intent para abrir APK iniciado com sucesso');
    })
    .catch((error) => {
      console.error('Erro ao iniciar intent para abrir APK:', error);
      this.setState({
        downloadErrorMessage: 'Não foi possível iniciar a instalação. Por favor, instale manualmente.',
      });
    });
};
// Exclui todos os arquivos da pasta mclauncher
  deleteAllFiles = () => {
    const mclauncherFolderPath = `${RNFS.ExternalStorageDirectoryPath}/mclauncher`;
  
    RNFS.readDir(mclauncherFolderPath)
      .then((result) => {
        const deletePromises = result.map((file) => RNFS.unlink(file.path));
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('Todos os arquivos foram excluídos.');
        this.setState({
          showDeleteButton: true,
          downloadCompleteMessage: '', // Limpe a mensagem de download
        });
      })
      .catch((error) => {
        console.error('Erro ao excluir arquivos:', error);
      });
  };

// Renderiza um item da lista de versões
  renderVersionItem = ({ item }) => {
    return (
      <TouchableHighlight
        onPress={() => this.openLink(item.link, item.nome)}
        style={styles.versionItem}
        underlayColor="#000000"
      >
        <Text style={styles.versionText}>{item.nome}</Text>
      </TouchableHighlight>
    );
  };
// Método de renderização principal
  render() {
    return (
      <View style={styles.container}>
        {!this.state.isManagePermitted && (
          <Button
            title="Permissão de arquivos"
            onPress={this.requestManageStoragePermission}
            disabled={this.state.isLoading}
            color="#1a620b"
          />
        )}
          <View style={styles.messageContainer}>
    {this.state.downloadErrorMessage !== '' && (
      <Text style={styles.errorMessage}>{this.state.downloadErrorMessage}</Text>
    )}
    {this.state.downloadSuccessMessage !== '' && (
      <Text style={styles.successMessage}>{this.state.downloadSuccessMessage}</Text>
    )}
  </View>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={require('./android/app/src/main/res/mipmap-xxxhdpi/title.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Versões do Jogo:</Text>
          </View>
          <Button
            title="Deletar Arquivos"
            onPress={this.deleteAllFiles}
            disabled={!this.state.showDeleteButton}
            color="red"
          />
          <Button
            title="Recarregar"
            onPress={() => this.fetchData()}
            disabled={this.state.isLoading}
            color="#1a620b"
          />
        </View>
        {this.state.isLoading ? (
          <ActivityIndicator size="large" color="white" />
        ) : (
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={{
                tabBarActiveTintColor: 'white',
                tabBarInactiveTintColor: 'gray',
                tabBarLabelStyle: { fontSize: 16 },
                tabBarStyle: { backgroundColor: '#000000' },
              }}
            >
              <Tab.Screen name="Stable">
                {() => <StableScreen versions={this.state.versions} openLink={this.openLink} />}
              </Tab.Screen>
              <Tab.Screen name="Beta">
                {() => <BetaScreen versions={this.state.versions} openLink={this.openLink} />}
              </Tab.Screen>
              <Tab.Screen name="Legacy">
                {() => <LegacyScreen versions={this.state.versions} openLink={this.openLink} />}
              </Tab.Screen>
              <Tab.Screen name="Sobre">
                {() => <AboutScreen />}
              </Tab.Screen>
            </Tab.Navigator>
          </NavigationContainer>
        )}

        {this.state.downloading && (
          <View style={styles.modalContainer}>
            <Text style={styles.modalText}>Baixando... {this.state.downloadProgress.toFixed(2)}%</Text>
            <ProgressBar
              styleAttr="Horizontal"
              color="#1a620b"
              indeterminate={false}
              progress={this.state.downloadProgress / 100}
              style={{ width: '80%' }}
            />
          </View>
        )}
      </View>
    );
  }
}
// Componente para a tela de versões estáveis
function StableScreen({ versions, openLink }) {
  const stableVersions = versions.filter((version) => version.tipo === 'Stable');

  return (
    <View style={styles.screenContainer}>
      <FlatList
        data={stableVersions}
        keyExtractor={(item) => item.versao}
        renderItem={({ item }) => (
          <TouchableHighlight
            onPress={() => openLink(item.link, item.nome)}
            style={styles.versionItem}
            underlayColor="#000000"
          >
            <Text style={styles.versionText}>{item.nome}</Text>
          </TouchableHighlight>
        )}
      />
    </View>
  );
}
// Componente para a tela de Sobre
function AboutScreen() {
  const telegramUsername = 'Mr_Purple_666';

  const openTelegram = () => {
    Linking.openURL(`https://t.me/${telegramUsername}`);
  };

  return (
    <View style={styles.aboutContainer}>
      <Text style={styles.aboutText}>
        Este app tem a função de baixar o Minecraft Bedrock (Android), onde você não precisará passar por encurtadores de links e afins. Fique à vontade para entrar em contato conosco no Telegram se tiver alguma dúvida.
      </Text>
      <TouchableOpacity onPress={openTelegram}>
        <Text style={styles.telegramLink}>{telegramUsername}</Text>
      </TouchableOpacity>
    </View>
  );
}
// Componente para a tela de versões beta
function BetaScreen({ versions, openLink }) {
  const betaVersions = versions.filter((version) => version.tipo === 'Beta');

  return (
    <View style={styles.screenContainer}>
      <FlatList
        data={betaVersions}
        keyExtractor={(item) => item.versao}
        renderItem={({ item }) => (
          <TouchableHighlight
            onPress={() => openLink(item.link, item.nome)}
            style={styles.versionItem}
            underlayColor="#000000"
          >
            <Text style={styles.versionText}>{item.nome}</Text>
          </TouchableHighlight>
        )}
      />
    </View>
  );
}
// Componente para a tela de versões legacy
function LegacyScreen({ versions, openLink }) {
  const legacyVersions = versions.filter((version) => version.tipo === 'Legacy');

  return (
    <View style={styles.screenContainer}>
      <FlatList
        data={legacyVersions}
        keyExtractor={(item) => item.versao}
        renderItem={({ item }) => (
          <TouchableHighlight
            onPress={() => openLink(item.link, item.nome)}
            style={styles.versionItem}
            underlayColor="#000000"
          >
            <Text style={styles.versionText}>{item.nome}</Text>
          </TouchableHighlight>
        )}
      />
    </View>
  );
}
// Estilos do aplicativo
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  logoContainer: {
    flex: 0,
    alignItems: 'center',
  },
  titleContainer: {
    flex: 0,
    alignItems: 'flex-start',
  },
  header: {
    flexDirection: 'column',
  },
  logo: {
    width: 256,
    height: 128,
    alignItems: 'center',
  },
  reloadButton: {
    borderRadius: 70,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: 'red',
    marginBottom: 10,
  },
  successMessage: {
    fontSize: 16,
    color: 'green',
    marginBottom: 10,
  },
  aboutContainer: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 16,
  },
  aboutText: {
    fontSize: 18,
    color: 'green',
    marginBottom: 20,
  },
  telegramLink: {
    fontSize: 18,
    color: '#c912e2',
    textDecorationLine: 'underline',
  },
  title: {
    fontSize: 24,
    marginTop: 0,
    marginBottom: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  versionItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  versionText: {
    color: 'green',
    fontSize: 18,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalText: {
    fontSize: 24,
    color: 'white',
    marginBottom: 20,
  },
});

export default App;
