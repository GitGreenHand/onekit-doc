import { defaultTheme } from 'vuepress'

export default {
  theme: defaultTheme({
    // 默认主题配置
  
      sidebar: [
        {
          title: 'receiver',   // 必要的
          path: '/receiver/',      // 可选的, 标题的跳转链接，应为绝对路径且必须存在
          collapsable: false, // 可选的, 默认值是 true,
          sidebarDepth: 1,    // 可选的, 默认值是 1
          children: [
            '/receiver/kafkametrics',
            '/receiver/kafka',
            '/receiver/kubelet',
          ]
        },
        // {
        //   title: 'Group 2',
        //   children: [ /* ... */ ],
        //   initialOpenGroupIndex: -1 // 可选的, 默认值是 0
        // }
      ],
    navbar: [
      {
        text: '首页',
        link: '/',
      },
      {
        text: 'receiver',
        link: '/receiver/',
      },
      {
        text: 'exporter',
        link: '/exporter',
      },
      {
        text: 'processor',
        link: '/processor',
      },
      {
        text: 'extension',
        link: '/extension',
      },
    ],
  }),
}