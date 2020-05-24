import * as fs from 'fs';
import { inject, injectable } from 'inversify';
import * as yaml from 'js-yaml';
import * as path from 'path';
import urljoin from 'url-join';
import IConfigFile from './IConfigFile';
import IConfiguration from './IConfiguration';
import ILogger from './ILogger';
import ILoggerModel from './ILoggerModel';

/**
 * Configuration
 * コンフィグ設定取得
 */
@injectable()
class Configuration implements IConfiguration {
    private config!: IConfigFile;
    private log: ILogger;

    constructor(@inject('ILoggerModel') logger: ILoggerModel) {
        this.log = logger.getLogger();

        this.readConfig();
        this.log.system.info('config.yml read success');

        fs.watchFile(Configuration.CONFIG_FILE_PATH, async () => {
            this.log.system.info('updeted config file');
            try {
                const newConfig = <any>(
                    yaml.safeLoad(await fs.promises.readFile(Configuration.CONFIG_FILE_PATH, 'utf-8'))
                );
                this.config = this.formatConfig(newConfig);
            } catch (err) {
                this.log.system.error('read config error');
                this.log.system.error(err);
            }
        });
    }

    /**
     * read config
     */
    private readConfig(): void {
        let str: string = '';
        try {
            str = fs.readFileSync(Configuration.CONFIG_FILE_PATH, 'utf-8');
        } catch (e) {
            if (e.code === 'ENOENT') {
                this.log.system.fatal('config.yml is not found');
            } else {
                this.log.system.fatal(e);
            }
            process.exit(1);
        }

        // parse configFile
        const newConfig: IConfigFile = <any>yaml.safeLoad(str);

        this.config = this.formatConfig(newConfig);
    }

    /**
     * 引数で渡された config のデフォルト値設定 & 整形
     * @param newConfig: IConfigFile
     * @return IConfigFile
     */
    private formatConfig(newConfig: IConfigFile): IConfigFile {
        this.setDefaultValues(newConfig);

        // subDirectory のパス整形
        if (typeof newConfig.subDirectory !== 'undefined') {
            newConfig.subDirectory = urljoin('/', newConfig.subDirectory).replace(/\/$/, '');
        }

        // recorded のパス整形
        for (let i = 0; i < newConfig.recorded.length; i++) {
            newConfig.recorded[i].path = this.directoryFormatting(newConfig.recorded[i].path);
        }

        // thumbnail のパス整形
        newConfig.thumbnail = this.directoryFormatting(newConfig.thumbnail);

        return newConfig;
    }

    /**
     * config デフォルト値をセットする
     * @param config: IConfigFile
     */
    private setDefaultValues(config: IConfigFile): void {
        for (const key in Configuration.DEFAULT_VALUE) {
            if (typeof (<any>config)[key] === 'undefined') {
                (<any>config)[key] = (<any>Configuration.DEFAULT_VALUE)[key];
            }
        }
    }

    /**
     * 引数で渡されたディレクトリの末尾のパス区切り文字を削除する
     * @param dir: ディレクトリパス
     */
    private directoryFormatting(dir: string): string {
        return dir.replace('%ROOT%', Configuration.ROOT_PATH).replace(new RegExp(`\\${path.sep}$`), '');
    }

    /**
     * コンフィグ設定を返す
     */
    public getConfig(): IConfigFile {
        return JSON.parse(JSON.stringify(this.config));
    }
}

namespace Configuration {
    export const CONFIG_FILE_PATH = path.join(__dirname, '..', '..', 'config', 'config.yml');
    export const ROOT_PATH = path.join(__dirname, '..', '..').replace(new RegExp(`\\${path.sep}$`), '');

    export const DEFAULT_VALUE: IConfigFile = {
        port: 8888,
        mirakurunPath: 'http+unix://%2Fvar%2Frun%2Fmirakurun.sock/',
        dbtype: 'sqlite',
        epgUpdateIntervalTime: 10,
        conflictPriority: 1,
        recPriority: 2,
        streamingPriority: 0,
        timeSpecifiedStartMargin: 1,
        timeSpecifiedEndMargin: 1,
        recordedFormat: '%YEAR%年%MONTH%月%DAY%日%HOUR%時%MIN%分%SEC%秒-%TITLE%',
        recordedFileExtension: '.ts',
        recorded: [
            {
                name: 'recorded',
                path: path.join(__dirname, '..', '..', 'recorded'),
            },
        ],
        thumbnail: path.join(__dirname, '..', '..', 'thumbnail'),
        thumbnailSize: '480x270',
        thumbnailPosition: 5,
        ffmpeg: '/usr/local/bin/ffmpeg',
        encodeProcessNum: 0,
        concurrentEncodeNum: 0,
        encode: [],
        urlscheme: {
            m2ts: {
                ios: 'vlc-x-callback://x-callback-url/stream?url=http://ADDRESS"',
                android: 'intent://ADDRESS#Intent;package=org.videolan.vlc;type=video;scheme=http;end',
            },
            video: {
                ios: 'infuse://x-callback-url/play?url=http://ADDRESS',
                android: 'intent://ADDRESS#Intent;package=com.mxtech.videoplayer.ad;type=video;scheme=http;end',
            },
            download: {
                ios: 'vlc-x-callback://x-callback-url/stream?url=http://ADDRESS',
            },
        },
    };
}

export default Configuration;
